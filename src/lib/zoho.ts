// Zoho integration — CRM contact search + Campaigns send.
// Uses a single self-client OAuth refresh token that covers both products.

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

const dc = () => (process.env.ZOHO_DC || "com").trim();
const accountsBase = () => `https://accounts.zoho.${dc()}`;
const crmBase      = () => `https://www.zohoapis.${dc()}/crm/v5`;
const campaignsBase = () => `https://campaigns.zoho.${dc()}/api/v1.1`;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
    client_id:     process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_CLIENT_SECRET!,
    grant_type:    "refresh_token",
  });

  const res = await fetch(`${accountsBase()}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Zoho token refresh failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return tokenCache.token;
}

// === CRM: search contacts by industry + zip ======================

export type ZohoContact = {
  id: string;
  Email: string | null;
  First_Name: string | null;
  Last_Name: string | null;
};

/**
 * Searches Zoho CRM contacts matching (Industry = industryValue) AND (zip in zipCodes).
 * Uses the COQL /crm/v5/coql endpoint for an efficient "IN" query.
 */
export async function searchContacts(params: {
  industryValue: string;
  zipCodes: string[];
}): Promise<ZohoContact[]> {
  const { industryValue, zipCodes } = params;
  if (!zipCodes.length) return [];

  const industryField = process.env.ZOHO_INDUSTRY_FIELD || "Industry";
  const token = await getAccessToken();
  const results: ZohoContact[] = [];
  let offset = 0;
  const limit = 200;

  // Escape single quotes to avoid COQL injection.
  const esc = (s: string) => s.replace(/'/g, "\\'");
  const zipList = zipCodes.map((z) => `'${esc(z)}'`).join(", ");
  const industryLit = `'${esc(industryValue)}'`;

  while (true) {
    const query = `select id, Email, First_Name, Last_Name
                   from Contacts
                   where ${industryField} = ${industryLit}
                     and Mailing_Zip in (${zipList})
                   limit ${offset}, ${limit}`;

    const res = await fetch(`${crmBase()}/coql`, {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ select_query: query }),
      cache: "no-store",
    });

    if (res.status === 204) break; // no rows

    if (!res.ok) {
      throw new Error(`Zoho CRM COQL failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as { data?: ZohoContact[]; info?: { more_records?: boolean } };
    const batch = json.data ?? [];
    results.push(...batch.filter((c) => !!c.Email));

    if (!json.info?.more_records || batch.length < limit) break;
    offset += limit;
  }

  return results;
}

// === Campaigns: create + send ====================================

/**
 * Creates a mailing list in Zoho Campaigns and adds the given contacts to it.
 * Returns the list key.
 */
async function createAndPopulateList(args: {
  token: string;
  listName: string;
  contacts: ZohoContact[];
}): Promise<string> {
  const { token, listName, contacts } = args;

  const createRes = await fetch(
    `${campaignsBase()}/createlist?resfmt=JSON&listname=${encodeURIComponent(listName)}&signupform=private`,
    {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    },
  );
  if (!createRes.ok) {
    throw new Error(`Zoho Campaigns createlist failed: ${createRes.status} ${await createRes.text()}`);
  }
  const createJson = (await createRes.json()) as { listkey?: string; list_key?: string; message?: string };
  const listkey = createJson.listkey ?? createJson.list_key;
  if (!listkey) throw new Error(`Zoho Campaigns createlist missing listkey: ${JSON.stringify(createJson)}`);

  // Add contacts in batches (Zoho accepts JSON array via listsubscribe).
  const chunk = 100;
  for (let i = 0; i < contacts.length; i += chunk) {
    const batch = contacts.slice(i, i + chunk).map((c) => ({
      "Contact Email": c.Email,
      "First Name": c.First_Name ?? "",
      "Last Name": c.Last_Name ?? "",
    }));

    const params = new URLSearchParams({
      resfmt: "JSON",
      listkey,
      emailids: JSON.stringify(batch),
    });

    const addRes = await fetch(`${campaignsBase()}/json/listsubscribe?${params}`, {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });
    if (!addRes.ok) {
      throw new Error(`Zoho Campaigns listsubscribe failed: ${addRes.status} ${await addRes.text()}`);
    }
  }

  return listkey;
}

export type CampaignResult = {
  campaignKey: string;
  recipientCount: number;
};

/**
 * End-to-end: creates a temp list of the given contacts, creates a campaign
 * with the provided HTML template, and sends it immediately.
 */
export async function sendCampaign(args: {
  campaignName: string;
  subject: string;
  htmlBody: string;
  contacts: ZohoContact[];
  fromEmail?: string;
  fromName?: string;
}): Promise<CampaignResult> {
  const { campaignName, subject, htmlBody, contacts } = args;
  const fromEmail = args.fromEmail || process.env.ZOHO_FROM_EMAIL;
  const fromName  = args.fromName  || process.env.ZOHO_FROM_NAME || "";
  if (!fromEmail) throw new Error("ZOHO_FROM_EMAIL is not set");
  if (!contacts.length) {
    return { campaignKey: "", recipientCount: 0 };
  }

  const token = await getAccessToken();
  const listName = `${campaignName} — ${new Date().toISOString()}`.slice(0, 120);
  const listkey = await createAndPopulateList({ token, listName, contacts });

  const createParams = new URLSearchParams({
    resfmt: "JSON",
    campaignname: campaignName,
    from_email: `${fromName ? `${fromName} <${fromEmail}>` : fromEmail}`,
    subject,
    list_details: JSON.stringify({ [listkey]: [] }),
  });

  const createRes = await fetch(
    `${campaignsBase()}/createCampaign?${createParams}`,
    {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ content: htmlBody }),
    },
  );
  if (!createRes.ok) {
    throw new Error(`Zoho Campaigns createCampaign failed: ${createRes.status} ${await createRes.text()}`);
  }
  const createJson = (await createRes.json()) as { campaign_key?: string; campaignkey?: string };
  const campaignKey = createJson.campaign_key ?? createJson.campaignkey;
  if (!campaignKey) {
    throw new Error(`Zoho Campaigns createCampaign missing key: ${JSON.stringify(createJson)}`);
  }

  // Send now.
  const sendRes = await fetch(
    `${campaignsBase()}/sendcampaign?resfmt=JSON&campaignkey=${encodeURIComponent(campaignKey)}`,
    {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    },
  );
  if (!sendRes.ok) {
    throw new Error(`Zoho Campaigns sendcampaign failed: ${sendRes.status} ${await sendRes.text()}`);
  }

  return { campaignKey, recipientCount: contacts.length };
}

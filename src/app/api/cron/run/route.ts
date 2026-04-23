import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextRunDate } from "@/lib/cron";
import { toZohoIndustry } from "@/lib/industries";
import { searchContacts, sendCampaign, sendTestEmail } from "@/lib/zoho";
import { getTestRecipients } from "@/lib/test-recipients";
import type { Attachment, Automation, ParsedRule, Template } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function baseUrl(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
  if (envUrl) return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderBody(template: Template, extra: Attachment[]): string {
  const all = [...(template.attachments ?? []), ...(extra ?? [])];
  if (!all.length) return template.html_body;
  const list = all.map((a) => `<li><a href="${a.url}">${escapeHtml(a.name)}</a></li>`).join("");
  return `${template.html_body}\n<hr/><p><strong>Attachments</strong></p><ul>${list}</ul>`;
}

function testBanner(params: { approveUrl: string; recipientCount: number; recipients: { email: string; name: string }[] }): string {
  const { approveUrl, recipientCount, recipients } = params;
  const sampleList = recipients.slice(0, 8).map((r) => `<li>${escapeHtml(r.name || "")}${r.email ? ` &lt;${escapeHtml(r.email)}&gt;` : ""}</li>`).join("");
  return `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin:0 0 20px;font-family:system-ui,sans-serif">
    <div style="font-weight:600;color:#92400e;margin-bottom:6px">⚠️ Test preview — not yet sent to customers</div>
    <p style="margin:4px 0;color:#78350f">This email would be sent to <strong>${recipientCount}</strong> recipient${recipientCount === 1 ? "" : "s"}:</p>
    <ul style="margin:6px 0 10px 18px;color:#78350f">${sampleList}${recipients.length > 8 ? `<li>… and ${recipients.length - 8} more</li>` : ""}</ul>
    <a href="${approveUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">✓ Approve &amp; send to all ${recipientCount}</a>
    <p style="margin:10px 0 0;color:#78350f;font-size:12px">If you didn't expect this, just ignore.</p>
  </div>`;
}

async function runOne(supabase: ReturnType<typeof createAdminClient>, a: Automation, origin: string) {
  const { data: runRow } = await supabase
    .from("runs")
    .insert({ automation_id: a.id, status: "success", recipient_count: 0 })
    .select("id").single();
  const runId = runRow?.id as string | undefined;

  const finish = async (patch: Record<string, unknown>) => {
    if (runId) await supabase.from("runs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", runId);
  };

  try {
    const rule = a.parsed_rule as ParsedRule;
    const industryValue = toZohoIndustry(rule.industry);
    if (!industryValue) throw new Error(`Unknown industry key: ${rule.industry}`);
    if (!a.template_id) throw new Error("Automation has no template");

    const { data: template } = await supabase.from("templates").select("*").eq("id", a.template_id).maybeSingle();
    if (!template) throw new Error(`Template not found: ${a.template_id}`);

    const contacts = await searchContacts({ industryValue, zipCodes: rule.zip_codes });
    if (contacts.length === 0) {
      await finish({ status: "skipped", recipient_count: 0, error: "No matching contacts" });
      return;
    }

    const campaignName = `${a.name} — ${new Date().toISOString().slice(0, 16)}`;
    const rendered = renderBody(template as Template, rule.attachments ?? []);

    if (a.test_mode) {
      const token = crypto.randomUUID();

      const approveUrl = `${origin}/api/approve?run_id=${runId}&token=${token}`;
      const banner = testBanner({
        approveUrl,
        recipientCount: contacts.length,
        recipients: contacts.map((c) => ({
          email: c.Email ?? "",
          name: [c.First_Name, c.Last_Name].filter(Boolean).join(" "),
        })),
      });
      const testHtml = banner + rendered;

      const testRes = await sendTestEmail({
        campaignName,
        subject: (template as Template).subject || a.name,
        htmlBody: testHtml,
        testRecipients: getTestRecipients(),
      });

      const snapshot = {
        subject: (template as Template).subject || a.name,
        html: rendered,
        emails: contacts.map((c) => c.Email ?? "").filter(Boolean),
        contacts: contacts.map((c) => ({ email: c.Email, first: c.First_Name, last: c.Last_Name })),
        campaignName,
      };

      await finish({
        status: "pending_approval",
        recipient_count: contacts.length,
        zoho_campaign_id: testRes.campaignKey || null,
        approval_token: token,
        snapshot,
      });
    } else {
      // Direct send.
      const result = await sendCampaign({
        campaignName,
        subject: (template as Template).subject || a.name,
        htmlBody: rendered,
        contacts,
      });
      await finish({
        status: "success",
        recipient_count: result.recipientCount,
        zoho_campaign_id: result.campaignKey || null,
      });
    }
  } catch (e: any) {
    await finish({ status: "error", error: (e?.message ?? String(e)).slice(0, 2000) });
  } finally {
    const next = nextRunDate(a.schedule_cron, a.timezone).toISOString();
    await supabase
      .from("automations")
      .update({ last_run_at: new Date().toISOString(), next_run_at: next })
      .eq("id", a.id);
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const origin = baseUrl(req);

  const { data: due, error } = await supabase
    .from("automations")
    .select("*")
    .eq("status", "active")
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (due ?? []) as Automation[];
  for (const a of list) {
    await runOne(supabase, a, origin);
  }

  return NextResponse.json({ processed: list.length, ids: list.map((a) => a.id) });
}

export const POST = GET;

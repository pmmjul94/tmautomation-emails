import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextRunDate } from "@/lib/cron";
import { toZohoIndustry } from "@/lib/industries";
import { searchContacts, sendCampaign } from "@/lib/zoho";
import type { Attachment, Automation, ParsedRule, Template } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow if unset (e.g. local dev)
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function renderBody(template: Template, extra: Attachment[]): string {
  const all = [...(template.attachments ?? []), ...(extra ?? [])];
  if (!all.length) return template.html_body;
  const list = all
    .map((a) => `<li><a href="${a.url}">${escapeHtml(a.name)}</a></li>`)
    .join("");
  return `${template.html_body}\n<hr/><p><strong>Attachments</strong></p><ul>${list}</ul>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

async function runOne(supabase: ReturnType<typeof createAdminClient>, a: Automation) {
  const runInsert = await supabase
    .from("runs")
    .insert({ automation_id: a.id, status: "success", recipient_count: 0 })
    .select("id").single();

  const runId = runInsert.data?.id;
  const finish = async (patch: Record<string, unknown>) => {
    if (runId) await supabase.from("runs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", runId);
  };

  try {
    const rule = a.parsed_rule as ParsedRule;
    const industryValue = toZohoIndustry(rule.industry);
    if (!industryValue) throw new Error(`Unknown industry key: ${rule.industry}`);
    if (!a.template_id) throw new Error("Automation has no template");

    const { data: template, error: tErr } = await supabase
      .from("templates").select("*").eq("id", a.template_id).maybeSingle();
    if (tErr || !template) throw new Error(`Template not found: ${a.template_id}`);

    const contacts = await searchContacts({ industryValue, zipCodes: rule.zip_codes });

    if (contacts.length === 0) {
      await finish({ status: "skipped", recipient_count: 0, error: "No matching contacts" });
      return;
    }

    const campaignName = `${a.name} — ${new Date().toISOString().slice(0, 16)}`;
    const html = renderBody(template as Template, rule.attachments ?? []);

    const result = await sendCampaign({
      campaignName,
      subject: (template as Template).subject || a.name,
      htmlBody: html,
      contacts,
    });

    await finish({
      status: "success",
      recipient_count: result.recipientCount,
      zoho_campaign_id: result.campaignKey || null,
    });
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
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: due, error } = await supabase
    .from("automations")
    .select("*")
    .eq("status", "active")
    .lte("next_run_at", now)
    .order("next_run_at", { ascending: true })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (due ?? []) as Automation[];

  // Process sequentially to keep Zoho rate limits friendly.
  for (const a of list) {
    await runOne(supabase, a);
  }

  return NextResponse.json({ processed: list.length, ids: list.map((a) => a.id) });
}

export const POST = GET;

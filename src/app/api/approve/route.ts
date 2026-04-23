import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampaign, type ZohoContact } from "@/lib/zoho";
import type { RunSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Public approval endpoint. Called when a reviewer clicks the "Approve & Send"
 * button in a test email. Authentication is via the one-time approval_token.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const runId = url.searchParams.get("run_id");
  const token = url.searchParams.get("token");

  if (!runId || !token) {
    return html("Missing parameters", "This approval link is malformed.", 400);
  }

  const supabase = createAdminClient();
  const { data: run } = await supabase
    .from("runs")
    .select("*, automation:automations(id, name)")
    .eq("id", runId)
    .maybeSingle();

  if (!run) return html("Not found", "This run doesn't exist.", 404);
  if (run.approval_token !== token) return html("Invalid token", "This approval link is invalid or has been used already.", 403);
  if (run.status !== "pending_approval") {
    return html("Already handled", `This campaign is already marked as "${run.status}".`, 409);
  }

  const snap = run.snapshot as RunSnapshot | null;
  if (!snap) return html("No snapshot", "Can't find the saved campaign data.", 500);

  try {
    const contacts: ZohoContact[] = (snap.contacts ?? snap.emails.map((e) => ({ email: e }))).map((c: any, i) => ({
      id: `approved-${i}`,
      Email: c.email,
      First_Name: c.first ?? null,
      Last_Name:  c.last  ?? null,
    }));

    const result = await sendCampaign({
      campaignName: snap.campaignName,
      subject: snap.subject,
      htmlBody: snap.html,
      contacts,
    });

    await supabase.from("runs").update({
      status: "approved",
      recipient_count: result.recipientCount,
      zoho_campaign_id: result.campaignKey || null,
      approval_token: null,
      approved_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    }).eq("id", runId);

    return html(
      "Campaign sent",
      `Sent to ${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"}. Zoho campaign key: ${result.campaignKey || "—"}.`,
      200,
    );
  } catch (e: any) {
    await supabase.from("runs").update({
      status: "error",
      error: (e?.message ?? String(e)).slice(0, 2000),
      finished_at: new Date().toISOString(),
    }).eq("id", runId);
    return html("Send failed", e?.message ?? "Unknown error", 500);
  }
}

function html(title: string, body: string, status: number) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:80px auto;padding:0 16px;color:#0f172a}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:24px;background:#fff}
h1{font-size:22px;margin:0 0 8px}p{color:#475569}</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

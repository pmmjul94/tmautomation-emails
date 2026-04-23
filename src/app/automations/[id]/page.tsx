import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AutomationBuilder } from "@/components/automation-builder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Automation, Run } from "@/lib/types";

export default async function AutomationDetailPage({ params }: { params: { id: string } }) {
  const { supabase } = await requireUser();

  const [{ data: automation }, { data: templates }, { data: runs }] = await Promise.all([
    supabase.from("automations").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("templates").select("id, name").order("name"),
    supabase.from("runs").select("*").eq("automation_id", params.id).order("started_at", { ascending: false }).limit(20),
  ]);

  if (!automation) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Edit automation</h1>
        <p className="text-sm text-muted-foreground">
          Next run: {formatDate(automation.next_run_at)} · Last run: {formatDate(automation.last_run_at)}
        </p>
      </div>

      <AutomationBuilder templates={templates ?? []} initial={automation as Automation} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run history</CardTitle>
        </CardHeader>
        <CardContent>
          {(runs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet. The cron will pick this up at the next due time.</p>
          ) : (
            <ul className="divide-y">
              {(runs as Run[]).map((r) => (
                <li key={r.id} className="flex items-start justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{formatDate(r.started_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.recipient_count} recipients
                      {r.zoho_campaign_id && <> · campaign <code className="rounded bg-muted px-1">{r.zoho_campaign_id}</code></>}
                    </div>
                    {r.error && <div className="mt-1 text-xs text-destructive break-all">{r.error}</div>}
                  </div>
                  <Badge variant={r.status === "success" ? "success" : r.status === "error" ? "destructive" : "secondary"}>{r.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

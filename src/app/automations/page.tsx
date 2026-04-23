import Link from "next/link";
import { Plus, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { industryLabel } from "@/lib/industries";
import type { ParsedRule } from "@/lib/types";

export default async function AutomationsListPage() {
  const { supabase } = await requireUser();
  const { data: automations } = await supabase
    .from("automations")
    .select("id, name, status, next_run_at, last_run_at, schedule_cron, timezone, parsed_rule")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Automations</h1>
        <Button asChild>
          <Link href="/automations/new"><Plus className="h-4 w-4" />New automation</Link>
        </Button>
      </div>

      {(automations ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No automations yet. <Link href="/automations/new" className="underline">Create your first one</Link>.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {automations!.map((a) => {
            const rule = a.parsed_rule as ParsedRule;
            return (
              <Link key={a.id} href={`/automations/${a.id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-medium">{a.name}</div>
                        <Badge variant={a.status === "active" ? "success" : "secondary"}>{a.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {industryLabel(rule.industry)} · ZIPs: {rule.zip_codes.join(", ")} · {a.schedule_cron} ({a.timezone})
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div className="flex items-center justify-end gap-1"><Clock className="h-3 w-3" />Next: {formatDate(a.next_run_at)}</div>
                      <div>Last: {formatDate(a.last_run_at)}</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

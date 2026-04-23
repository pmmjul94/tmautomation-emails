import Link from "next/link";
import { Workflow, Mail, Clock, Activity } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const { supabase } = await requireUser();

  const [{ data: automations }, { data: templates }, { data: runs }] = await Promise.all([
    supabase.from("automations").select("id, name, status, next_run_at, last_run_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("templates").select("id", { count: "exact", head: false }),
    supabase.from("runs").select("id, automation_id, started_at, status, recipient_count").order("started_at", { ascending: false }).limit(5),
  ]);

  const activeCount = (automations ?? []).filter((a) => a.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/templates/new">New template</Link></Button>
          <Button asChild><Link href="/automations/new">New automation</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Workflow className="h-4 w-4" />} label="Active automations" value={activeCount} />
        <StatCard icon={<Mail className="h-4 w-4" />} label="Templates" value={templates?.length ?? 0} />
        <StatCard icon={<Activity className="h-4 w-4" />} label="Recent runs" value={runs?.length ?? 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Automations</CardTitle>
            <Link href="/automations" className="text-sm text-muted-foreground hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {(automations ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No automations yet. <Link href="/automations/new" className="underline">Create one</Link>.</p>
            ) : (
              <ul className="divide-y">
                {automations!.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <Link href={`/automations/${a.id}`} className="block truncate text-sm font-medium hover:underline">{a.name}</Link>
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Next: {formatDate(a.next_run_at)}</div>
                    </div>
                    <Badge variant={a.status === "active" ? "success" : "secondary"}>{a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent runs</CardTitle>
          </CardHeader>
          <CardContent>
            {(runs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            ) : (
              <ul className="divide-y">
                {runs!.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <div className="min-w-0">
                      <Link href={`/automations/${r.automation_id}`} className="font-medium hover:underline">{formatDate(r.started_at)}</Link>
                      <div className="text-xs text-muted-foreground">{r.recipient_count} recipients</div>
                    </div>
                    <Badge variant={r.status === "success" ? "success" : r.status === "error" ? "destructive" : "secondary"}>{r.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
        <div className="rounded-md bg-muted p-2">{icon}</div>
      </CardContent>
    </Card>
  );
}

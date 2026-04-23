import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StarterTemplatesButton } from "@/components/starter-templates";
import { formatDate } from "@/lib/utils";

export default async function TemplatesPage() {
  const { supabase } = await requireUser();
  const { data: templates } = await supabase
    .from("templates")
    .select("id, name, subject, updated_at, attachments")
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Templates</h1>
        <div className="flex items-center gap-2">
          <StarterTemplatesButton />
          <Button asChild>
            <Link href="/templates/new"><Plus className="h-4 w-4" />New template</Link>
          </Button>
        </div>
      </div>

      {(templates ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No templates yet. <Link href="/templates/new" className="underline">Create your first one</Link>.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates!.map((t) => (
            <Link href={`/templates/${t.id}`} key={t.id}>
              <Card className="h-full transition-colors hover:bg-accent">
                <CardHeader>
                  <CardTitle className="truncate text-base">{t.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="truncate text-muted-foreground">{t.subject || <span className="italic">no subject</span>}</div>
                  <div className="text-xs text-muted-foreground">Updated {formatDate(t.updated_at)}</div>
                  {Array.isArray(t.attachments) && t.attachments.length > 0 && (
                    <div className="text-xs text-muted-foreground">{t.attachments.length} attachment(s)</div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

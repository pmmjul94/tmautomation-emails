import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AutomationBuilder } from "@/components/automation-builder";

export default async function NewAutomationPage() {
  const { supabase } = await requireUser();
  const { data: templates } = await supabase
    .from("templates").select("id, name").order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">New automation</h1>
      {(templates ?? []).length === 0 && (
        <div className="rounded-md border bg-muted p-3 text-sm">
          You don't have any templates yet. <Link href="/templates/new" className="underline">Create one first</Link>.
        </div>
      )}
      <AutomationBuilder templates={templates ?? []} />
    </div>
  );
}

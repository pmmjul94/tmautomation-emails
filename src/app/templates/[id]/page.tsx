import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { TemplateEditor } from "@/components/template-editor";
import type { Template } from "@/lib/types";

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const { supabase } = await requireUser();
  const { data: template } = await supabase
    .from("templates").select("*").eq("id", params.id).maybeSingle();
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Edit template</h1>
      <TemplateEditor initial={template as Template} />
    </div>
  );
}

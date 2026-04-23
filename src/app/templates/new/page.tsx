import { requireUser } from "@/lib/auth";
import { TemplateEditor } from "@/components/template-editor";

export default async function NewTemplatePage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">New template</h1>
      <TemplateEditor />
    </div>
  );
}

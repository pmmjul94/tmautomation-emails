"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import type { Attachment } from "@/lib/types";

type Props = { templateId: string | null; extraAttachments?: Attachment[] };

type TemplatePayload = {
  subject: string;
  html_body: string;
  attachments: Attachment[];
};

export function EmailPreview({ templateId, extraAttachments = [] }: Props) {
  const [t, setT] = useState<TemplatePayload | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let abort = false;
    if (!templateId) { setT(null); return; }
    setLoading(true);
    fetch(`/api/templates/${templateId}`)
      .then((r) => r.json())
      .then((json) => { if (!abort) setT(json.template as TemplatePayload); })
      .catch(() => { if (!abort) setT(null); })
      .finally(() => { if (!abort) setLoading(false); });
    return () => { abort = true; };
  }, [templateId]);

  if (!templateId) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground"><Mail className="h-4 w-4" /> Email preview</div>
        <p className="mt-2">Pick a template to see what recipients will get.</p>
      </div>
    );
  }
  if (loading || !t) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading preview…</div>
    );
  }

  const combined = [...(t.attachments ?? []), ...extraAttachments];

  return (
    <div className="rounded-md border">
      <div className="border-b p-3">
        <div className="flex items-center gap-2 text-sm font-medium"><Mail className="h-4 w-4" /> Email preview</div>
        <div className="mt-2 text-sm">
          <div><span className="text-muted-foreground">Subject: </span>{t.subject || <em>(no subject)</em>}</div>
        </div>
      </div>
      <div className="p-4">
        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: t.html_body || "<em>(empty body)</em>" }} />
        {combined.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <div className="text-sm font-medium">Attachments</div>
            <ul className="mt-1 space-y-1">
              {combined.map((a, i) => (
                <li key={i} className="text-sm">
                  <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{a.name}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

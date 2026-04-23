"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/editor";
import { AttachmentPicker } from "@/components/attachment-picker";
import { useToast } from "@/components/toast";
import type { Attachment, Template } from "@/lib/types";

type Props = { initial?: Template };

export function TemplateEditor({ initial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [html, setHtml] = useState(initial?.html_body ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>(initial?.attachments ?? []);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { toast({ title: "Name is required", variant: "error" }); return; }
    setSaving(true);
    try {
      const url = initial ? `/api/templates/${initial.id}` : "/api/templates";
      const res = await fetch(url, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, html_body: html, attachments }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { id } = await res.json();
      toast({ title: initial ? "Template saved" : "Template created", variant: "success" });
      router.push(`/templates/${initial?.id ?? id}`);
      router.refresh();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial) return;
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/templates/${initial.id}`, { method: "DELETE" });
    if (res.ok) { router.push("/templates"); router.refresh(); }
    else toast({ title: "Delete failed", description: await res.text(), variant: "error" });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="tpl-name">Name</Label>
        <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Menu" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tpl-subject">Subject</Label>
        <Input id="tpl-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="New menu items this spring" />
      </div>
      <div className="space-y-1.5">
        <Label>Body</Label>
        <RichTextEditor value={html} onChange={setHtml} placeholder="Write your email…" />
      </div>
      <div className="space-y-1.5">
        <Label>Attachments</Label>
        <AttachmentPicker value={attachments} onChange={setAttachments} />
        <p className="text-xs text-muted-foreground">Attachment URLs are appended as links in the email body when the campaign is sent.</p>
      </div>
      <div className="flex items-center justify-between">
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : initial ? "Save changes" : "Create template"}</Button>
        {initial && <Button variant="destructive" onClick={remove}>Delete</Button>}
      </div>
    </div>
  );
}

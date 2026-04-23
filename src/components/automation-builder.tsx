"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Wand2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AttachmentPicker } from "@/components/attachment-picker";
import { useToast } from "@/components/toast";
import { INDUSTRIES, INDUSTRY_KEYS, industryLabel } from "@/lib/industries";
import type { Attachment, Automation, ParsedRule } from "@/lib/types";

type TemplateLite = { id: string; name: string };

type Props = {
  templates: TemplateLite[];
  initial?: Automation;
};

const EXAMPLE =
  "Send email to all restaurants in 90210 with the 'Spring Menu' template every Tuesday at 10am PST.";

export function AutomationBuilder({ templates, initial }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [prompt, setPrompt] = useState(initial?.nl_prompt ?? "");
  const [rule, setRule] = useState<ParsedRule | null>(
    initial ? (initial.parsed_rule as ParsedRule) : null,
  );
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"active" | "paused">(initial?.status ?? "active");

  useEffect(() => { if (initial) setRule(initial.parsed_rule as ParsedRule); }, [initial]);

  async function parse() {
    if (!prompt.trim()) return;
    setParsing(true);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Parse failed");
      setRule(json.rule as ParsedRule);
      toast({ title: "Parsed!", description: "Review the fields below and save.", variant: "success" });
    } catch (e: any) {
      toast({ title: "Couldn't parse prompt", description: e.message, variant: "error" });
    } finally { setParsing(false); }
  }

  async function save() {
    if (!rule) { toast({ title: "Parse the prompt first", variant: "error" }); return; }
    if (!rule.template_id) { toast({ title: "Pick a template", variant: "error" }); return; }
    setSaving(true);
    try {
      const url = initial ? `/api/automations/${initial.id}` : "/api/automations";
      const body = initial
        ? { rule, nl_prompt: prompt, status }
        : { rule, nl_prompt: prompt };
      const res = await fetch(url, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = initial ? { id: initial.id } : await res.json();
      toast({ title: initial ? "Saved" : "Automation created", variant: "success" });
      router.push(`/automations/${json.id}`);
      router.refresh();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "error" });
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!initial) return;
    if (!confirm("Delete this automation?")) return;
    const res = await fetch(`/api/automations/${initial.id}`, { method: "DELETE" });
    if (res.ok) { router.push("/automations"); router.refresh(); }
    else toast({ title: "Delete failed", description: await res.text(), variant: "error" });
  }

  const updateRule = <K extends keyof ParsedRule>(key: K, val: ParsedRule[K]) =>
    setRule((r) => (r ? { ...r, [key]: val } : r));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Describe your automation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder={EXAMPLE}
          />
          <div className="flex items-center gap-2">
            <Button onClick={parse} disabled={parsing || !prompt.trim()} variant="outline">
              <Wand2 className="h-4 w-4" />{parsing ? "Parsing…" : "Parse with Gemini"}
            </Button>
            {!initial && !prompt && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setPrompt(EXAMPLE)}>Use example</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {rule && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm & edit</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Field label="Name">
              <Input value={rule.name} onChange={(e) => updateRule("name", e.target.value)} />
            </Field>

            <Field label="Industry">
              <Select value={rule.industry} onValueChange={(v) => updateRule("industry", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDUSTRY_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>{industryLabel(k)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="ZIP codes (comma-separated)" className="md:col-span-2">
              <Input
                value={rule.zip_codes.join(", ")}
                onChange={(e) =>
                  updateRule("zip_codes",
                    e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  )
                }
              />
            </Field>

            <Field label="Template">
              <Select value={rule.template_id ?? ""} onValueChange={(v) => updateRule("template_id", v || null)}>
                <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                <SelectContent>
                  {templates.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No templates — create one first.</div>}
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {rule.template_hint && !rule.template_id && (
                <p className="text-xs text-amber-600">Couldn't match template "{rule.template_hint}" — pick one above.</p>
              )}
            </Field>

            <Field label="Timezone">
              <Input value={rule.timezone} onChange={(e) => updateRule("timezone", e.target.value)} />
            </Field>

            <Field label="Cron schedule" className="md:col-span-2">
              <Input value={rule.schedule_cron} onChange={(e) => updateRule("schedule_cron", e.target.value)} />
              <p className="text-xs text-muted-foreground">5-field cron in the selected timezone. Example: <code>0 10 * * 2</code> = every Tuesday 10:00.</p>
            </Field>

            <Field label="Extra attachments" className="md:col-span-2">
              <AttachmentPicker value={rule.attachments ?? []} onChange={(v) => updateRule("attachments", v as Attachment[])} />
              <p className="text-xs text-muted-foreground">Appended to the template's own attachments at send time.</p>
            </Field>

            {initial && (
              <Field label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as "active" | "paused")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button onClick={save} disabled={!rule || saving}>
          <Save className="h-4 w-4" />{saving ? "Saving…" : initial ? "Save changes" : "Create automation"}
        </Button>
        {initial && <Button variant="destructive" onClick={remove}>Delete</Button>}
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

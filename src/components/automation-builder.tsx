"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Wand2, Save, TestTube2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { AttachmentPicker } from "@/components/attachment-picker";
import { ScheduleBuilder } from "@/components/schedule-builder";
import { RecipientsPreview } from "@/components/recipients-preview";
import { EmailPreview } from "@/components/email-preview";
import { useToast } from "@/components/toast";
import { INDUSTRY_KEYS, industryLabel } from "@/lib/industries";
import type { Attachment, Automation, ParsedRule } from "@/lib/types";

type TemplateLite = { id: string; name: string };
type Props = { templates: TemplateLite[]; initial?: Automation };

const EXAMPLE = "Send email to all restaurants in 90210 with the 'Spring Menu' template every Tuesday at 10am PST.";

const DEFAULT_RULE: ParsedRule = {
  name: "New automation",
  industry: "restaurants",
  zip_codes: [],
  template_id: null,
  template_hint: null,
  attachments: [],
  schedule_cron: "0 10 * * 2",
  timezone: "America/Los_Angeles",
};

export function AutomationBuilder({ templates, initial }: Props) {
  const router = useRouter();
  const toast = useToast();

  const [prompt, setPrompt] = useState(initial?.nl_prompt ?? "");
  const [rule, setRule] = useState<ParsedRule>(
    initial ? (initial.parsed_rule as ParsedRule) : DEFAULT_RULE,
  );
  const [status, setStatus] = useState<"active" | "paused">(initial?.status ?? "active");
  const [testMode, setTestMode] = useState<boolean>(initial?.test_mode ?? true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zipsInput, setZipsInput] = useState<string>(rule.zip_codes.join(", "));

  useEffect(() => { setZipsInput(rule.zip_codes.join(", ")); }, [rule.zip_codes.join(",")]); // eslint-disable-line

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
      toast({ title: "Parsed!", description: "Review the fields below.", variant: "success" });
    } catch (e: any) {
      toast({ title: "Couldn't parse prompt", description: e.message, variant: "error" });
    } finally { setParsing(false); }
  }

  function updateRule<K extends keyof ParsedRule>(key: K, val: ParsedRule[K]) {
    setRule((r) => ({ ...r, [key]: val }));
  }

  async function save() {
    if (!rule.name.trim()) { toast({ title: "Name is required", variant: "error" }); return; }
    if (!rule.template_id) { toast({ title: "Pick a template", variant: "error" }); return; }
    if (rule.zip_codes.length === 0) { toast({ title: "Add at least one ZIP code", variant: "error" }); return; }
    setSaving(true);
    try {
      const url = initial ? `/api/automations/${initial.id}` : "/api/automations";
      const body = initial
        ? { rule, nl_prompt: prompt, status, test_mode: testMode }
        : { rule, nl_prompt: prompt, test_mode: testMode };
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        {/* 1. AI quickfill */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Describe it in plain English (optional)</CardTitle>
            <CardDescription>Gemini will pre-fill the fields below. You can also skip this and set everything manually.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder={EXAMPLE} />
            <div className="flex items-center gap-2">
              <Button type="button" onClick={parse} disabled={parsing || !prompt.trim()} variant="outline">
                <Wand2 className="h-4 w-4" />{parsing ? "Parsing…" : "AI quick-fill"}
              </Button>
              {!prompt && <Button type="button" variant="ghost" size="sm" onClick={() => setPrompt(EXAMPLE)}>Use example</Button>}
            </div>
          </CardContent>
        </Card>

        {/* 2. Name */}
        <Card>
          <CardHeader><CardTitle className="text-base">Name</CardTitle></CardHeader>
          <CardContent>
            <Input value={rule.name} onChange={(e) => updateRule("name", e.target.value)} placeholder="Spring menu promo to 90210 restaurants" />
          </CardContent>
        </Card>

        {/* 3. Audience */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audience</CardTitle>
            <CardDescription>Who in Zoho CRM gets this?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select value={rule.industry} onValueChange={(v) => updateRule("industry", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_KEYS.map((k) => <SelectItem key={k} value={k}>{industryLabel(k)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ZIP codes</Label>
                <Input
                  value={zipsInput}
                  onChange={(e) => setZipsInput(e.target.value)}
                  onBlur={() => updateRule("zip_codes", zipsInput.split(",").map((s) => s.trim()).filter(Boolean))}
                  placeholder="90210, 90211"
                />
                <p className="text-xs text-muted-foreground">Comma-separated US 5-digit ZIPs.</p>
              </div>
            </div>
            <RecipientsPreview industry={rule.industry} zipCodes={rule.zip_codes} />
          </CardContent>
        </Card>

        {/* 4. Email */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What they'll get</CardTitle>
            <CardDescription>Pick a saved template.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label>Template</Label>
                <Select value={rule.template_id ?? ""} onValueChange={(v) => updateRule("template_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No templates yet.</div>}
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {rule.template_hint && !rule.template_id && (
                  <p className="text-xs text-amber-600">Couldn't match "{rule.template_hint}" — pick one above.</p>
                )}
              </div>
              <div className="flex items-end">
                <Button asChild variant="outline" size="sm"><Link href="/templates/new">New template</Link></Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Extra attachments (optional)</Label>
              <AttachmentPicker value={rule.attachments ?? []} onChange={(v) => updateRule("attachments", v as Attachment[])} />
              <p className="text-xs text-muted-foreground">Appended to the template's own attachments at send time.</p>
            </div>
          </CardContent>
        </Card>

        {/* 5. Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">When</CardTitle>
            <CardDescription>Pick a schedule.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScheduleBuilder
              cron={rule.schedule_cron}
              timezone={rule.timezone}
              onChange={({ cron, timezone }) => setRule((r) => ({ ...r, schedule_cron: cron, timezone }))}
            />
          </CardContent>
        </Card>

        {/* 6. Test mode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><TestTube2 className="h-4 w-4" />Approval before send</CardTitle>
            <CardDescription>While this is on, every scheduled run sends a preview to reviewers who must click "Approve &amp; send" before real contacts receive anything.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">Test / approval mode</div>
                <div className="text-sm text-muted-foreground">
                  {testMode ? "On — preview sent to reviewers first, real send only after approval." : "Off — campaigns go out directly to matching contacts at the scheduled time."}
                </div>
              </div>
              <Switch checked={testMode} onChange={setTestMode} />
            </div>
            <p className="text-xs text-muted-foreground">
              Reviewers (env <code>TEST_RECIPIENTS</code>): <code>wais@textmunication.com</code>, <code>ab@caazllc.com</code>. Change by setting <code>TEST_RECIPIENTS=a@x.com,b@y.com</code> in Vercel.
            </p>
          </CardContent>
        </Card>

        {initial && (
          <Card>
            <CardHeader><CardTitle className="text-base">Status</CardTitle></CardHeader>
            <CardContent>
              <Select value={status} onValueChange={(v) => setStatus(v as "active" | "paused")}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4" />{saving ? "Saving…" : initial ? "Save changes" : "Create automation"}
          </Button>
          {initial && (
            <Button variant="destructive" onClick={remove}>
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          )}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 self-start">
        <EmailPreview templateId={rule.template_id} extraAttachments={rule.attachments} />
      </aside>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

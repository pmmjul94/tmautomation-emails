import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { nextRunDate, validateCron } from "@/lib/cron";
import { INDUSTRY_KEYS } from "@/lib/industries";

const ruleSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.enum(INDUSTRY_KEYS as [string, ...string[]]),
  zip_codes: z.array(z.string().regex(/^\d{5}$/)).min(1),
  template_id: z.string().uuid().nullable(),
  template_hint: z.string().nullable().optional(),
  schedule_cron: z.string().min(1),
  timezone: z.string().min(1),
  attachments: z.array(z.any()).default([]),
});

const patchSchema = z.object({
  rule: ruleSchema.optional(),
  status: z.enum(["active", "paused"]).optional(),
  test_mode: z.boolean().optional(),
  nl_prompt: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const update: Record<string, unknown> = {};

  if (parsed.data.rule) {
    const rule = parsed.data.rule;
    const cronErr = validateCron(rule.schedule_cron, rule.timezone);
    if (cronErr) return NextResponse.json({ error: cronErr }, { status: 400 });
    update.name = rule.name;
    update.parsed_rule = rule;
    update.template_id = rule.template_id;
    update.schedule_cron = rule.schedule_cron;
    update.timezone = rule.timezone;
    update.next_run_at = nextRunDate(rule.schedule_cron, rule.timezone).toISOString();
  }
  if (parsed.data.status) update.status = parsed.data.status;
  if (parsed.data.test_mode !== undefined) update.test_mode = parsed.data.test_mode;
  if (parsed.data.nl_prompt !== undefined) update.nl_prompt = parsed.data.nl_prompt;

  const { error } = await supabase.from("automations").update(update).eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await supabase.from("automations").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

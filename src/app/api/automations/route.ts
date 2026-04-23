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

const bodySchema = z.object({
  nl_prompt: z.string().min(1),
  rule: ruleSchema,
});

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { nl_prompt, rule } = parsed.data;

  const cronErr = validateCron(rule.schedule_cron, rule.timezone);
  if (cronErr) return NextResponse.json({ error: cronErr }, { status: 400 });

  if (rule.template_id) {
    const { data } = await supabase.from("templates").select("id").eq("id", rule.template_id).maybeSingle();
    if (!data) return NextResponse.json({ error: "Template not found" }, { status: 400 });
  }

  const next_run_at = nextRunDate(rule.schedule_cron, rule.timezone).toISOString();

  const { data, error } = await supabase
    .from("automations")
    .insert({
      user_id: user.id,
      name: rule.name,
      nl_prompt,
      parsed_rule: rule,
      template_id: rule.template_id,
      schedule_cron: rule.schedule_cron,
      timezone: rule.timezone,
      status: "active",
      next_run_at,
    })
    .select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id });
}

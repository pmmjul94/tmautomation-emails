import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseAutomationPrompt } from "@/lib/gemini";
import { validateCron } from "@/lib/cron";

const bodySchema = z.object({ prompt: z.string().min(1).max(2000) });

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  try {
    const { rule, raw } = await parseAutomationPrompt(parsed.data.prompt);

    const cronErr = validateCron(rule.schedule_cron, rule.timezone);
    if (cronErr) {
      return NextResponse.json({ error: `Invalid cron from Gemini: ${cronErr}`, raw }, { status: 422 });
    }

    // Resolve template_hint → template_id against this user's templates.
    let template_id: string | null = null;
    if (rule.template_hint) {
      const { data } = await supabase
        .from("templates").select("id, name")
        .ilike("name", `%${rule.template_hint}%`)
        .limit(1);
      template_id = data?.[0]?.id ?? null;
    }

    return NextResponse.json({
      rule: { ...rule, template_id, attachments: [] },
      raw,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Parse failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { STARTER_TEMPLATES } from "@/lib/starter-templates";

const bodySchema = z.object({ keys: z.array(z.string()).optional() });

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  const keys = parsed.success ? parsed.data.keys : undefined;

  const picks = keys && keys.length
    ? STARTER_TEMPLATES.filter((t) => keys.includes(t.name))
    : STARTER_TEMPLATES;

  const rows = picks.map((t) => ({
    user_id: user.id,
    name: t.name,
    subject: t.subject,
    html_body: t.html_body,
    attachments: [],
  }));

  const { data, error } = await supabase.from("templates").insert(rows).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ created: data?.length ?? 0 });
}

export async function GET() {
  return NextResponse.json({ starters: STARTER_TEMPLATES });
}

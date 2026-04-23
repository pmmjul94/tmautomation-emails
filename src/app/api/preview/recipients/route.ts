import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { INDUSTRY_KEYS, toZohoIndustry } from "@/lib/industries";
import { searchContacts } from "@/lib/zoho";

const bodySchema = z.object({
  industry: z.enum(INDUSTRY_KEYS as [string, ...string[]]),
  zip_codes: z.array(z.string().regex(/^\d{5}$/)).min(1),
});

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const industryValue = toZohoIndustry(parsed.data.industry);
  if (!industryValue) return NextResponse.json({ error: "Unknown industry" }, { status: 400 });

  try {
    const contacts = await searchContacts({
      industryValue,
      zipCodes: parsed.data.zip_codes,
    });
    const sample = contacts.slice(0, 5).map((c) => ({
      email: c.Email,
      name: [c.First_Name, c.Last_Name].filter(Boolean).join(" "),
    }));
    return NextResponse.json({ count: contacts.length, sample });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Preview failed" }, { status: 500 });
  }
}

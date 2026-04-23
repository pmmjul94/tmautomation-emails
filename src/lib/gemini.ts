import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { INDUSTRY_KEYS } from "./industries";
import type { ParsedRule } from "./types";

const parsedRuleSchema = z.object({
  name: z.string().min(1).max(120),
  industry: z.enum(INDUSTRY_KEYS as [string, ...string[]]),
  zip_codes: z.array(z.string().regex(/^\d{5}$/)).min(1),
  template_hint: z.string().nullable(),
  schedule_cron: z.string().min(1),
  timezone: z.string().min(1),
});

const SYSTEM_PROMPT = `You convert a user's plain-English description of an email campaign automation into a strict JSON object. Output ONLY valid JSON, no prose, no code fences.

Schema:
{
  "name": string,                 // short human-readable name for the automation, derived from the prompt
  "industry": one of ${JSON.stringify(INDUSTRY_KEYS)},
  "zip_codes": string[],          // US 5-digit ZIP codes; empty array is not allowed
  "template_hint": string|null,   // the name of the email template the user references (e.g. "Spring Menu"), or null
  "schedule_cron": string,        // 5-field cron expression in the given timezone
  "timezone": string              // IANA timezone, e.g. "America/Los_Angeles"
}

Rules:
- Map industry synonyms conservatively: "restaurant/cafe/bar/food" -> restaurants; "gym/fitness/wellness/yoga" -> health-fitness; "nonprofit/charity/ngo" -> non-profit; "retail/ecommerce/shop/store/boutique" -> retail-ecomm.
- If the user writes a timezone like "PST" / "Pacific" / "ET" / "Eastern", map to the closest IANA zone (PST -> America/Los_Angeles, EST/ET -> America/New_York, CST -> America/Chicago, MST -> America/Denver). Default to "America/Los_Angeles" if missing.
- Cron day-of-week: Sunday=0. "every Tuesday at 10am" -> "0 10 * * 2". "every weekday" -> "0 9 * * 1-5" (pick time from prompt). "every month on the 1st" -> "0 9 1 * *".
- Always return 5-field cron (no seconds, no year).
- template_hint is the template NAME the user refers to, not an ID. If they don't name one, return null.
- If something is ambiguous, make the most reasonable assumption rather than failing.`;

export async function parseAutomationPrompt(prompt: string): Promise<{
  rule: Omit<ParsedRule, "template_id" | "attachments">;
  raw: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`Gemini returned non-JSON output: ${raw.slice(0, 200)}`);
  }

  const parsed = parsedRuleSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Gemini output failed validation: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  return { rule: parsed.data, raw };
}

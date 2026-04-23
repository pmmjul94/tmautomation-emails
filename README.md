# Zoho Email Automator

A Next.js 14 web app that lets a non-technical user create email-campaign automations in plain English and run them on a schedule.

> "Send email to all restaurants in 90210 with the 'Spring Menu' template every Tuesday at 10am PST."

Gemini parses the sentence into structured JSON, the user confirms, and a Vercel cron runs the campaign via Zoho CRM (contact filter) + Zoho Campaigns (send).

---

## Stack

| Layer           | Tech                                                  |
| --------------- | ----------------------------------------------------- |
| Framework       | Next.js 14 App Router · TypeScript · Tailwind CSS     |
| UI              | shadcn/ui + Radix primitives · Tiptap rich-text editor |
| Database / Auth | Supabase (Postgres + RLS + email/password auth)       |
| File storage    | Supabase Storage (`email-assets` bucket)              |
| AI              | Google Gemini (`gemini-2.0-flash`, JSON mode)         |
| CRM             | Zoho CRM v5 (COQL contact search)                     |
| Email           | Zoho Campaigns v1.1                                   |
| Scheduling      | Vercel Cron (every 5 min)                             |

## Features

- **Email composer** — Tiptap rich-text editor with inline image upload, attachment picker, and reusable templates.
- **Automation builder** — plain-English prompt → Gemini → structured rule `{ industry, zip_codes, template_id, attachments, schedule_cron, timezone, name }`. The parsed result is shown for user review/edit before saving.
- **Supported industries** — restaurants, health & fitness, non-profit, retail/ecomm (see [`src/lib/industries.ts`](src/lib/industries.ts) — map each to your CRM picklist values).
- **Dashboard** — list, pause/resume, delete automations; see next run & last run.
- **Execution** — `/api/cron/run` is invoked by Vercel every 5 min. It picks every active automation whose `next_run_at <= now()`, filters Zoho contacts, creates a Zoho Campaigns campaign + list, sends, logs the result, and advances `next_run_at`.
- **Run history** — per-automation log of timestamps, recipient counts, Zoho campaign IDs, success/error.

---

## Local setup

### 1. Prerequisites

- Node 18+
- Supabase project
- Google AI Studio API key
- Zoho developer account with CRM + Campaigns enabled (or trial)

### 2. Install

```bash
git clone <this repo>
cd zoho-email-automator
npm install
cp .env.local.example .env.local
```

Fill in `.env.local` (see the Zoho OAuth and Supabase sections below for how to get each value).

### 3. Supabase

1. Create a new Supabase project.
2. In the SQL Editor, paste & run [`supabase/seed.sql`](supabase/seed.sql). This creates the `templates`, `automations`, `runs` tables, RLS policies, the updated-at trigger, and the `email-assets` storage bucket.
3. In Project Settings → API, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL` **and** `SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠ server-only — never ship to the client)
4. Authentication → Providers → enable **Email** (password). Optionally disable email confirmation for faster local testing (Authentication → Email Templates → Confirm signup).

### 4. Gemini

1. Get a key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Set `GEMINI_API_KEY` in `.env.local`.

### 5. Zoho OAuth (CRM + Campaigns)

Both APIs share the same OAuth app and refresh token.

1. Go to https://api-console.zoho.com/ → **Add Client** → **Self Client**.
2. Click **Create Now**, note the `Client ID` and `Client Secret`.
3. Open the **Generate Code** tab and paste this scope string:
   ```
   ZohoCRM.modules.contacts.READ,ZohoCRM.coql.READ,ZohoCampaigns.campaign.ALL,ZohoCampaigns.contact.ALL
   ```
   Pick **Time Duration: 10 minutes**, a short description, and click **Create**. Copy the one-time code — it expires fast.
4. Exchange it for a refresh token. Pick the matching data centre (`com`, `eu`, `in`, `com.au`, `jp`):
   ```bash
   curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
     -d "grant_type=authorization_code" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "redirect_uri=https://www.zoho.com" \
     -d "code=THE_CODE_FROM_STEP_3"
   ```
   The response contains `refresh_token`. Save it — Zoho will only return it **once**.
5. Set the env vars:
   - `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`
   - `ZOHO_ORG_ID` — from Zoho Campaigns → Settings → Developer Space → API Keys
   - `ZOHO_DC` — `com` / `eu` / `in` / `com.au` / `jp` (match your account)
   - `ZOHO_FROM_EMAIL`, `ZOHO_FROM_NAME` — a **verified** sender in Zoho Campaigns
   - `ZOHO_INDUSTRY_FIELD` — the exact CRM field name holding the industry value. Default `Industry`. If you use a custom field, put its API name here (e.g. `Industry_Type__c`).
6. In Zoho CRM, make sure the `Industry` picklist values on Contacts match the right-hand side of [`src/lib/industries.ts`](src/lib/industries.ts). Edit either side so they line up — the values must match **exactly** (case-sensitive).
7. Contacts must have a `Mailing_Zip` value to be included. To use a different zip field, edit the COQL query in [`src/lib/zoho.ts`](src/lib/zoho.ts).

### 6. Run it

```bash
npm run dev
```

Open http://localhost:3000, sign up, create a template, then create an automation.

**Test the cron locally:**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/run
```

---

## Deploying to Vercel

1. Push to GitHub.
2. Import the repo into Vercel.
3. In **Project Settings → Environment Variables**, add every var from `.env.local.example`. Scope them to *Production* (and *Preview* if you want previews to also run the cron).
4. Vercel will auto-detect [`vercel.json`](vercel.json) and register the cron:
   ```json
   { "crons": [{ "path": "/api/cron/run", "schedule": "*/5 * * * *" }] }
   ```
   Vercel automatically injects a `Bearer $CRON_SECRET` header on scheduled invocations — set `CRON_SECRET` to any long random string and the endpoint will accept calls only when the header matches.
5. In Supabase → Authentication → URL Configuration, add your Vercel domain to *Site URL* and to *Redirect URLs* (`https://<your-domain>/auth/callback`).
6. Deploy. After the first deploy, the cron begins firing every 5 minutes.

---

## How a run works

```
                 ┌────────────────────┐
   Vercel Cron ─▶│ GET /api/cron/run │ (every 5 min, Bearer CRON_SECRET)
                 └─────────┬──────────┘
                           │ pick active automations where next_run_at <= now()
                           ▼
                 ┌────────────────────┐
                 │ Zoho CRM /coql     │  select Contacts where Industry=X and Mailing_Zip in (...)
                 └─────────┬──────────┘
                           ▼
                 ┌────────────────────┐
                 │ Zoho Campaigns     │  createlist → listsubscribe → createCampaign → sendcampaign
                 └─────────┬──────────┘
                           ▼
                 ┌────────────────────┐
                 │ Supabase: runs row │  status, recipient_count, zoho_campaign_id
                 │        + automation.next_run_at advanced
                 └────────────────────┘
```

## Schema

- `automations` — `(id, user_id, name, nl_prompt, parsed_rule jsonb, template_id, schedule_cron, timezone, status, next_run_at, last_run_at, created_at, updated_at)`
- `templates` — `(id, user_id, name, subject, html_body, attachments jsonb, created_at, updated_at)`
- `runs` — `(id, automation_id, started_at, finished_at, recipient_count, zoho_campaign_id, status, error)`

All tables are protected by RLS: each user only sees their own rows. The cron endpoint uses the service-role key to bypass RLS.

## Files worth knowing

| File | Purpose |
|---|---|
| [`src/lib/gemini.ts`](src/lib/gemini.ts) | System prompt + Zod-validated structured output |
| [`src/lib/zoho.ts`](src/lib/zoho.ts) | Token refresh, COQL contact search, Campaigns send |
| [`src/lib/industries.ts`](src/lib/industries.ts) | Industry key → Zoho picklist value map |
| [`src/lib/cron.ts`](src/lib/cron.ts) | `next_run_at` calculation with timezone support |
| [`src/app/api/cron/run/route.ts`](src/app/api/cron/run/route.ts) | The execution loop |
| [`src/components/automation-builder.tsx`](src/components/automation-builder.tsx) | NL prompt → parse → confirm → save |
| [`src/components/editor.tsx`](src/components/editor.tsx) | Tiptap rich-text editor w/ Supabase image upload |

## Troubleshooting

- **"Gemini returned non-JSON output"** — rare, usually a prompt that's too vague. Ask the user to include industry, ZIPs, template, and schedule.
- **"Zoho token refresh failed"** — confirm `ZOHO_DC` matches the account, and that the refresh token hasn't been revoked.
- **"No matching contacts"** — runs are recorded as `skipped`. Verify the Industry picklist values and `Mailing_Zip` data in CRM.
- **Cron never fires** — `CRON_SECRET` mismatch, or the deployment doesn't include `vercel.json`. Hit the endpoint manually with `curl` to confirm it runs.

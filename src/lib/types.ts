export type Attachment = {
  url: string;
  name: string;
  size: number;
  type: string;
};

export type ParsedRule = {
  industry: string;                 // industry key, e.g. "restaurants"
  zip_codes: string[];              // e.g. ["90210", "90211"]
  template_id: string | null;       // resolved template uuid (null if Gemini couldn't find one)
  template_hint: string | null;     // raw template name from the prompt, used to resolve template_id
  attachments: Attachment[];        // usually [] — filled in by the user
  schedule_cron: string;            // e.g. "0 10 * * 2"
  timezone: string;                 // IANA tz, e.g. "America/Los_Angeles"
  name: string;                     // short human name for the automation
};

export type Template = {
  id: string;
  user_id: string;
  name: string;
  subject: string;
  html_body: string;
  attachments: Attachment[];
  created_at: string;
  updated_at: string;
};

export type Automation = {
  id: string;
  user_id: string;
  name: string;
  nl_prompt: string;
  parsed_rule: ParsedRule;
  template_id: string | null;
  schedule_cron: string;
  timezone: string;
  status: "active" | "paused";
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Run = {
  id: string;
  automation_id: string;
  started_at: string;
  finished_at: string | null;
  recipient_count: number;
  zoho_campaign_id: string | null;
  status: "success" | "error" | "skipped";
  error: string | null;
};

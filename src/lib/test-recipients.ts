// Reviewers who get the "test" email before a real send.
// Override via env var TEST_RECIPIENTS (comma-separated) if you want.

const DEFAULT = ["wais@textmunication.com", "ab@caazllc.com"];

export function getTestRecipients(): string[] {
  const raw = process.env.TEST_RECIPIENTS;
  if (!raw) return DEFAULT;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

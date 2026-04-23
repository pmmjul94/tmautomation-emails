import cronParser from "cron-parser";

export function nextRunDate(
  cron: string,
  timezone: string,
  from: Date = new Date(),
): Date {
  const it = cronParser.parseExpression(cron, { currentDate: from, tz: timezone });
  return it.next().toDate();
}

export function validateCron(cron: string, timezone = "UTC"): string | null {
  try {
    cronParser.parseExpression(cron, { tz: timezone });
    return null;
  } catch (e: unknown) {
    return e instanceof Error ? e.message : "Invalid cron expression";
  }
}

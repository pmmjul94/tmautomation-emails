"use client";

import { useMemo, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Frequency = "daily" | "weekly" | "monthly" | "custom";

const DAYS: { key: number; short: string; full: string }[] = [
  { key: 0, short: "Sun", full: "Sunday" },
  { key: 1, short: "Mon", full: "Monday" },
  { key: 2, short: "Tue", full: "Tuesday" },
  { key: 3, short: "Wed", full: "Wednesday" },
  { key: 4, short: "Thu", full: "Thursday" },
  { key: 5, short: "Fri", full: "Friday" },
  { key: 6, short: "Sat", full: "Saturday" },
];

const TIMEZONES = [
  { id: "America/Los_Angeles", label: "Pacific (PT)" },
  { id: "America/Denver",      label: "Mountain (MT)" },
  { id: "America/Chicago",     label: "Central (CT)" },
  { id: "America/New_York",    label: "Eastern (ET)" },
  { id: "America/Phoenix",     label: "Arizona (no DST)" },
  { id: "America/Anchorage",   label: "Alaska" },
  { id: "Pacific/Honolulu",    label: "Hawaii" },
  { id: "UTC",                 label: "UTC" },
];

type Props = {
  cron: string;
  timezone: string;
  onChange: (next: { cron: string; timezone: string }) => void;
};

function parseCron(cron: string): { freq: Frequency; hour: number; minute: number; days: number[]; dayOfMonth: number } {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return { freq: "custom", hour: 9, minute: 0, days: [2], dayOfMonth: 1 };
  const [minStr, hrStr, domStr, , dowStr] = parts;
  const minute = Number(minStr);
  const hour = Number(hrStr);
  if (Number.isNaN(minute) || Number.isNaN(hour)) return { freq: "custom", hour: 9, minute: 0, days: [2], dayOfMonth: 1 };

  if (domStr === "*" && (dowStr === "*" || dowStr === "?")) {
    return { freq: "daily", hour, minute, days: [0,1,2,3,4,5,6], dayOfMonth: 1 };
  }
  if (domStr === "*" && dowStr !== "*") {
    const days = dowStr.split(",").map((s) => Number(s)).filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6);
    if (days.length) return { freq: "weekly", hour, minute, days, dayOfMonth: 1 };
  }
  const dom = Number(domStr);
  if (!Number.isNaN(dom) && dowStr === "*") {
    return { freq: "monthly", hour, minute, days: [2], dayOfMonth: dom };
  }
  return { freq: "custom", hour, minute, days: [2], dayOfMonth: 1 };
}

function buildCron(freq: Frequency, hour: number, minute: number, days: number[], dayOfMonth: number): string {
  const m = Math.max(0, Math.min(59, minute));
  const h = Math.max(0, Math.min(23, hour));
  if (freq === "daily") return `${m} ${h} * * *`;
  if (freq === "weekly") {
    const d = days.length ? [...new Set(days)].sort().join(",") : "1";
    return `${m} ${h} * * ${d}`;
  }
  if (freq === "monthly") {
    const dom = Math.max(1, Math.min(28, dayOfMonth));
    return `${m} ${h} ${dom} * *`;
  }
  return `${m} ${h} * * *`;
}

export function ScheduleBuilder({ cron, timezone, onChange }: Props) {
  const parsed = useMemo(() => parseCron(cron), [cron]);
  const [freq, setFreq] = useState<Frequency>(parsed.freq);
  const [hour, setHour] = useState<number>(parsed.hour);
  const [minute, setMinute] = useState<number>(parsed.minute);
  const [days, setDays] = useState<number[]>(parsed.days);
  const [dayOfMonth, setDayOfMonth] = useState<number>(parsed.dayOfMonth);
  const [rawCron, setRawCron] = useState<string>(cron);

  // keep internal state in sync when parent resets cron (e.g. after Gemini parse)
  useEffect(() => {
    const p = parseCron(cron);
    setFreq(p.freq);
    setHour(p.hour);
    setMinute(p.minute);
    setDays(p.days);
    setDayOfMonth(p.dayOfMonth);
    setRawCron(cron);
  }, [cron]);

  useEffect(() => {
    if (freq === "custom") return;
    const next = buildCron(freq, hour, minute, days, dayOfMonth);
    if (next !== cron) onChange({ cron: next, timezone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freq, hour, minute, days.join(","), dayOfMonth]);

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  const hour12 = ((hour + 11) % 12) + 1;
  const ampm = hour >= 12 ? "PM" : "AM";

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Frequency</Label>
          <Select value={freq} onValueChange={(v) => setFreq(v as Frequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Every day</SelectItem>
              <SelectItem value="weekly">Weekly on specific days</SelectItem>
              <SelectItem value="monthly">Monthly on a day</SelectItem>
              <SelectItem value="custom">Custom cron</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Timezone</Label>
          <Select value={timezone} onValueChange={(v) => onChange({ cron, timezone: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {freq !== "custom" && (
          <div className="space-y-1.5">
            <Label>Time</Label>
            <div className="flex items-center gap-2">
              <Select value={String(hour12)} onValueChange={(v) => {
                const h12 = Number(v);
                setHour(ampm === "PM" ? (h12 % 12) + 12 : h12 % 12);
              }}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => <SelectItem key={h} value={String(h)}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
              <span>:</span>
              <Select value={String(minute).padStart(2, "0")} onValueChange={(v) => setMinute(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 15, 30, 45].map((m) => <SelectItem key={m} value={String(m).padStart(2, "0")}>{String(m).padStart(2, "0")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={ampm} onValueChange={(v) => {
                const h12 = ((hour + 11) % 12) + 1;
                setHour(v === "PM" ? (h12 % 12) + 12 : h12 % 12);
              }}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {freq === "weekly" && (
        <div className="space-y-1.5">
          <Label>Days</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => toggleDay(d.key)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  days.includes(d.key)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-accent"
                }`}
              >
                {d.short}
              </button>
            ))}
          </div>
        </div>
      )}

      {freq === "monthly" && (
        <div className="space-y-1.5">
          <Label>Day of month</Label>
          <Select value={String(dayOfMonth)} onValueChange={(v) => setDayOfMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">1–28 only, to avoid skipped months.</p>
        </div>
      )}

      {freq === "custom" && (
        <div className="space-y-1.5">
          <Label>Cron expression</Label>
          <Input value={rawCron} onChange={(e) => { setRawCron(e.target.value); onChange({ cron: e.target.value, timezone }); }} />
          <p className="text-xs text-muted-foreground">5-field cron. Example: <code>0 10 * * 2</code> = Tuesdays 10:00.</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Current schedule: <code>{cron}</code> ({timezone})
      </p>
    </div>
  );
}

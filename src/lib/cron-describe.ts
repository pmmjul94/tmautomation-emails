// Turn a 5-field cron string into a human-readable description.

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function twelveHour(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function describeCron(cron: string, tz: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return `${cron} (${tz})`;
  const [minStr, hrStr, domStr, , dowStr] = parts;
  const minute = Number(minStr);
  const hour = Number(hrStr);

  if (Number.isNaN(minute) || Number.isNaN(hour)) return `${cron} (${tz})`;
  const time = twelveHour(hour, minute);
  const tzShort = tz.replace("America/", "").replace(/_/g, " ");

  if (domStr === "*" && (dowStr === "*" || dowStr === "?")) {
    return `Every day at ${time} (${tzShort})`;
  }
  if (domStr === "*" && dowStr !== "*") {
    const days = dowStr.split(",").map((s) => Number(s)).filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6);
    if (days.length) {
      const list = days.map((d) => DAY_NAMES[d]).join(", ");
      return `Every ${list} at ${time} (${tzShort})`;
    }
  }
  const dom = Number(domStr);
  if (!Number.isNaN(dom) && dowStr === "*") {
    const suffix = dom === 1 ? "st" : dom === 2 ? "nd" : dom === 3 ? "rd" : "th";
    return `Monthly on the ${dom}${suffix} at ${time} (${tzShort})`;
  }
  return `${cron} (${tz})`;
}

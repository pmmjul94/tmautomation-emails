"use client";

import { useState } from "react";
import { Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { industry: string | null; zipCodes: string[] };

export function RecipientsPreview({ industry, zipCodes }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [sample, setSample] = useState<{ email: string | null; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setError(null);
    if (!industry || zipCodes.length === 0) {
      setError("Pick an industry and at least one ZIP first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/preview/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, zip_codes: zipCodes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Preview failed");
      setCount(json.count);
      setSample(json.sample ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" />
          Who will receive this?
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Checking…" : count === null ? "Preview recipients" : "Refresh"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {count !== null && (
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-semibold">{count.toLocaleString()}</span> matching contact{count === 1 ? "" : "s"} in Zoho CRM.
          </p>
          {sample.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">Sample (first {sample.length}):</p>
              <ul className="space-y-1">
                {sample.map((s, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{s.name || "—"}</span>
                    {s.email && <span className="text-muted-foreground"> · {s.email}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {count === 0 && <p className="text-sm text-amber-600">No contacts match yet. Double-check the industry value and ZIP codes.</p>}
        </div>
      )}

      {count === null && !error && (
        <p className="text-xs text-muted-foreground">Click preview to query Zoho CRM for matching contacts.</p>
      )}
    </div>
  );
}

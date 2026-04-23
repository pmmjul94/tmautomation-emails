"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/toast";

export function StarterTemplatesButton() {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function importAll() {
    if (!confirm("Add all 4 starter templates to your library?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/templates/starters", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast({ title: `Imported ${json.created} templates`, variant: "success" });
      router.refresh();
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "error" });
    } finally { setBusy(false); }
  }

  return (
    <Button type="button" variant="outline" onClick={importAll} disabled={busy}>
      <Sparkles className="h-4 w-4" />{busy ? "Importing…" : "Import starter templates"}
    </Button>
  );
}

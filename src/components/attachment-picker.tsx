"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Attachment } from "@/lib/types";

type Props = {
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
};

export function AttachmentPicker({ value, onChange }: Props) {
  const supabase = createClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `${user.id}/attachments/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "email-assets";
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
      if (error) { alert(`Upload failed: ${error.message}`); return; }
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange([...value, { url: data.publicUrl, name: file.name, size: file.size, type: file.type }]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
          <Paperclip className="h-4 w-4" /> {uploading ? "Uploading…" : "Add attachment"}
        </Button>
        <input ref={fileInput} type="file" className="hidden" onChange={handleFile} />
      </div>
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((a, i) => (
            <li key={`${a.url}-${i}`} className="flex items-center justify-between rounded border px-3 py-1.5 text-sm">
              <a href={a.url} target="_blank" rel="noreferrer" className="truncate hover:underline">{a.name}</a>
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

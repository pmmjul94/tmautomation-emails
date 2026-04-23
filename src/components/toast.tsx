"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Toast = { id: number; title: string; description?: string; variant?: "default" | "error" | "success" };

const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() { return useContext(ToastCtx); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    setToasts((prev) => [...prev, { ...t, id: Date.now() + Math.random() }]);
  }, []);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((prev) => prev.slice(1)), 4000);
    return () => clearTimeout(t);
  }, [toasts]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`min-w-[260px] rounded-md border px-4 py-3 shadow-md text-sm bg-background ${
              t.variant === "error" ? "border-destructive" : t.variant === "success" ? "border-green-500" : ""
            }`}
          >
            <div className="font-medium">{t.title}</div>
            {t.description && <div className="text-muted-foreground">{t.description}</div>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

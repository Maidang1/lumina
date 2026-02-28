import React, { useEffect, useState } from "react";
import { listenToast, ToastPayload } from "@/lib/toast";

interface ActiveToast extends ToastPayload {
  expiresAt: number;
}

const TOAST_LIFETIME_MS = 3200;

const typeClass: Record<ToastPayload["type"], string> = {
  info: "border-white/12 bg-[var(--card)]/92 text-[var(--foreground)]",
  success: "border-emerald-500/35 bg-emerald-950/78 text-emerald-100",
  error: "border-rose-500/35 bg-rose-950/78 text-rose-100",
};

export function ToastViewport(): React.ReactElement | null {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    const unsubscribe = listenToast((toast) => {
      setToasts((prev) => [
        ...prev,
        {
          ...toast,
          expiresAt: Date.now() + TOAST_LIFETIME_MS,
        },
      ]);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (toasts.length === 0) {
      return;
    }
    const timer = window.setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((toast) => toast.expiresAt > now));
    }, 250);
    return () => window.clearInterval(timer);
  }, [toasts.length]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[1000] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border px-3 py-2.5 text-xs leading-relaxed shadow-[var(--shadow-elevation-2)] backdrop-blur-md transition-opacity ${typeClass[toast.type]}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { listenToast, ToastPayload } from "@/lib/toast";

interface ActiveToast extends ToastPayload {
  expiresAt: number;
}

const TOAST_LIFETIME_MS = 3200;

const typeClass: Record<ToastPayload["type"], string> = {
  info: "border-zinc-700/70 bg-zinc-900/95 text-zinc-100",
  success: "border-emerald-600/70 bg-emerald-950/95 text-emerald-100",
  error: "border-rose-600/70 bg-rose-950/95 text-rose-100",
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
    <div className="pointer-events-none fixed right-4 top-4 z-[1000] flex w-[min(90vw,360px)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur ${typeClass[toast.type]}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

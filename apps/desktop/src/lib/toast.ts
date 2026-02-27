export type ToastType = "info" | "success" | "error";

export interface ToastPayload {
  id: number;
  type: ToastType;
  message: string;
}

const TOAST_EVENT = "lumina:toast";
let toastId = 0;

export function pushToast(message: string, type: ToastType = "info"): void {
  if (typeof window === "undefined") {
    return;
  }
  toastId += 1;
  const payload: ToastPayload = {
    id: toastId,
    type,
    message,
  };
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}

export function listenToast(
  listener: (payload: ToastPayload) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event): void => {
    const custom = event as CustomEvent<ToastPayload>;
    if (!custom.detail) {
      return;
    }
    listener(custom.detail);
  };

  window.addEventListener(TOAST_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(TOAST_EVENT, handler as EventListener);
  };
}

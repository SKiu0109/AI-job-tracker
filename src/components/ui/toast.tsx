"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
};

type ToastContextValue = {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  toasts: Toast[];
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, id: `${id}-exiting` } : t)));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== `${id}-exiting`));
    }, 200);
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "success", duration = 3000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const toast: Toast = { id, message, type, duration };

      setToasts((prev) => [...prev.slice(-4), toast]);

      const timer = setTimeout(() => removeToast(id), duration);
      timers.current.set(id, timer);
    },
    [removeToast]
  );

  useEffect(() => {
    const activeTimers = timers.current;

    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toasts }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

const typeStyles: Record<ToastType, string> = {
  success: "border-app-success-border bg-app-success-soft text-app-success",
  error: "border-app-danger-border bg-app-danger-soft text-app-danger",
  info: "border-app-info-border bg-app-info-soft text-app-info",
  warning: "border-app-warning-border bg-app-warning-soft text-app-warning",
};

const typeIcons: Record<ToastType, ReactNode> = {
  success: (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  info: (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  warning: (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
};

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-4 right-4 z-[100] flex flex-col-reverse gap-2 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80"
    >
      {toasts.map((toast) => {
        const isExiting = toast.id.endsWith("-exiting");
        const realId = isExiting ? toast.id.replace("-exiting", "") : toast.id;

        return (
          <div
            className={cn(
              "pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border px-4 py-3 shadow-app-floating backdrop-blur-xl",
              isExiting ? "toast-exit" : "toast-enter",
              typeStyles[toast.type]
            )}
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
          >
            <span className="mt-0.5">{typeIcons[toast.type]}</span>
            <p className="flex-1 text-[13px] font-medium leading-5">{toast.message}</p>
            <button
              aria-label="Dismiss notification"
              className="ml-1 shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
              onClick={() => onDismiss(realId)}
              type="button"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

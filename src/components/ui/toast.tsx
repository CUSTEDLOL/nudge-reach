"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "error" | "info";

export type ToastOptions = {
  title?: string;
  description: string;
  tone?: ToastTone;
  /** Auto-dismiss delay in ms (default 4000; errors 6000). */
  duration?: number;
};

type ToastRecord = ToastOptions & { id: number; tone: ToastTone };

type ToastContextValue = {
  toast: (options: ToastOptions) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const toneStyles: Record<ToastTone, { icon: ReactNode; bar: string }> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />,
    bar: "bg-emerald-500",
  },
  error: {
    icon: <CircleAlert className="h-4 w-4 text-red-600" aria-hidden />,
    bar: "bg-red-500",
  },
  info: {
    icon: <Info className="h-4 w-4 text-sky-600" aria-hidden />,
    bar: "bg-sky-500",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = ++idRef.current;
      const tone = options.tone ?? "info";
      setToasts((prev) => [...prev.slice(-4), { ...options, id, tone }]);
      const duration = options.duration ?? (tone === "error" ? 6000 : 4000);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="animate-rise pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-xl border border-black/5 bg-white p-3.5 pr-9 shadow-lift"
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 w-1",
                toneStyles[t.tone].bar
              )}
              aria-hidden
            />
            <span className="mt-0.5 shrink-0">{toneStyles[t.tone].icon}</span>
            <div className="min-w-0">
              {t.title && (
                <p className="text-sm font-semibold text-neutral-900">
                  {t.title}
                </p>
              )}
              <p className="text-sm text-neutral-600">{t.description}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="absolute right-2 top-2 rounded-lg p-1 text-neutral-400 outline-none transition-colors duration-150 hover:bg-black/5 hover:text-neutral-600 focus-visible:ring-2 focus-visible:ring-brand-400/50"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

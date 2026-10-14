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
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, X, Loader2 } from "lucide-react";
import clsx from "clsx";

/* ——————————————— Логотип ——————————————— */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="37" height="37" rx="9" stroke="url(#lg)" strokeWidth="2.4" />
      <path d="M11 15.5h18M11 24.5h18M15.5 11v18M24.5 11v18" stroke="url(#lg)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="15.5" cy="15.5" r="2.6" fill="#4cc2ff" />
      <circle cx="24.5" cy="24.5" r="2.6" fill="#7c5cff" />
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="#4cc2ff" />
          <stop offset="1" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("animate-spin", className ?? "size-4")} />;
}

/* ——————————————— Тосты ——————————————— */
type Toast = { id: number; kind: "ok" | "err" | "info"; text: string };
const ToastCtx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={clsx(
                "glass pointer-events-auto flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px] leading-snug",
                t.kind === "err" && "border-rose-400/40 text-rose-200",
                t.kind === "ok" && "border-mint-400/40 text-emerald-100",
                t.kind === "info" && "text-fog-200",
              )}
            >
              {t.kind === "err" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-400" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint-400" />
              )}
              <span className="flex-1">{t.text}</span>
              <button
                className="text-fog-500 transition hover:text-fog-200"
                onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/* ——————————————— Модалка ——————————————— */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={clsx(
              "glass relative w-full rounded-2xl p-6 shadow-2xl shadow-black/60",
              wide ? "max-w-2xl" : "max-w-md",
            )}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-display text-[15px] font-semibold tracking-wide text-fog-50">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-fog-500 transition hover:bg-ink-700 hover:text-fog-200"
                aria-label="Закрыть"
              >
                <X className="size-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmText = "Удалить",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text: string;
  confirmText?: string;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="mb-5 text-sm leading-relaxed text-fog-400">{text}</p>
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          Отмена
        </button>
        <button className="btn btn-danger btn-sm" disabled={loading} onClick={onConfirm}>
          {loading && <Spinner className="size-3.5" />}
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

/* ——————————————— Пустые состояния и бейджи ——————————————— */
export function Empty({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="dots-grid flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-600 px-6 py-12 text-center">
      <div className="text-pulse-400/80">{icon}</div>
      <p className="font-medium text-fog-200">{title}</p>
      {hint && <p className="max-w-sm text-[13px] leading-relaxed text-fog-500">{hint}</p>}
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "owner" | "ok" | "warn";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider",
        tone === "neutral" && "bg-ink-700/70 text-fog-300",
        tone === "owner" && "bg-vio-500/15 text-vio-400 ring-1 ring-vio-500/40",
        tone === "ok" && "bg-mint-400/10 text-mint-400 ring-1 ring-mint-400/30",
        tone === "warn" && "bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/30",
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  let hue = 0;
  for (let i = 0; i < name.length; i++) hue = (hue * 31 + name.charCodeAt(i)) % 360;
  return (
    <span
      className={clsx(
        "inline-flex size-8 shrink-0 select-none items-center justify-center rounded-full text-[11px] font-bold text-ink-950",
        className,
      )}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 80% 65%), hsl(${(hue + 50) % 360} 75% 55%))` }}
      title={name}
    >
      {initials || "?"}
    </span>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-xl"
          style={{
            background:
              "linear-gradient(100deg, rgba(21,29,43,.5) 30%, rgba(38,51,74,.55) 50%, rgba(21,29,43,.5) 70%)",
            backgroundSize: "200% 100%",
            animation: `sheen 1.6s linear infinite`,
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}

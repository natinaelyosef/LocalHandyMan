"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, RefreshCw, Star } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { statusClass, URGENCY_CLASS } from "@/lib/client";
import { useLocale } from "@/context/locale";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function usePageId(): string {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
}

export function errText(e: unknown, t?: TFn): string {
  if (e instanceof Error && e.message) return e.message;
  return t ? t("common.error") : "Something went wrong. Please try again.";
}

export function useStatusLabel(): (status?: string | null) => string {
  const { t } = useLocale();
  return (status?: string | null) => {
    if (!status) return "";
    const norm = status.trim().toLowerCase().replace(/\s+/g, "_");
    const keys = [`common.status.${norm}`, `common.verification.${norm}`, `customer.status.${norm}`];
    for (const k of keys) {
      const out = t(k);
      if (out !== k) return out;
    }
    return prettify(status);
  };
}

export function prettify(v: unknown): string {
  const s = String(v || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "—";
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function todayStr(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const statusLabel = useStatusLabel();
  if (!status) return null;
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(status)}`}>
      {label || statusLabel(status)}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency?: string }) {
  const { t } = useLocale();
  if (!urgency) return null;
  const k = `common.urgency.${urgency.trim().toLowerCase()}`;
  const out = t(k);
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_CLASS[urgency] || "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400"}`}>
      {out !== k ? out : prettify(urgency)}
    </span>
  );
}

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs font-medium text-red-600 dark:text-red-400">{msg}</p>;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  children,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-14 text-center">
      <Icon className="h-10 w-10 text-muted-foreground" />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 px-6 py-12 text-center">
      <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
      <p className="mt-3 max-w-md text-sm font-medium text-red-700 dark:text-red-300">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4 bg-card" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function CardsSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-36 rounded-xl" />
      ))}
    </div>
  );
}

export function RowsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

export function Stars({
  value,
  onChange,
  size = "h-4 w-4",
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: string;
}) {
  const { t } = useLocale();
  const rounded = Math.round(value || 0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= rounded;
        const cls = `${size} ${filled ? "text-amber-400" : "text-muted-foreground/40"}`;
        if (!onChange) {
          return <Star key={n} className={cls} fill={filled ? "currentColor" : "none"} />;
        }
        return (
          <button
            key={n}
            type="button"
            aria-label={n === 1 ? t("customer.starOne") : t("customer.starMany", { n })}
            onClick={() => onChange(n)}
            className="rounded p-0.5 transition hover:scale-110"
          >
            <Star className={cls} fill={filled ? "currentColor" : "none"} />
          </button>
        );
      })}
    </div>
  );
}

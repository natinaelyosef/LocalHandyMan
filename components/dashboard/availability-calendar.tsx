"use client";

import { useMemo } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { useLocale } from "@/context/locale";
import { dayKey, DAY_KEYS } from "@/lib/services/availability";

export type AvailabilityDay = {
  date: string;
  weekday: string;
  available: boolean;
  reasons?: string[];
  window?: { open: string; close: string };
  bookings?: { _id: string; code?: string; title?: string; status?: string }[];
};

const MONTHS_KEY = "common.month";

function monthLabel(year: number, month: number, t: (key: string) => string): string {
  const key = `${MONTHS_KEY}.${month}`;
  const out = t(key);
  if (out !== key) {
    return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  return `${out} ${year}`;
}

/**
 * Month-grid availability view. Purely presentational: it renders whatever
 * `days` it is given, so the worker calendar and the customer-facing picker
 * share one implementation.
 */
export function AvailabilityMonth({
  days,
  selected,
  onSelect,
  interactive = true,
  showLegend = true,
}: {
  days: AvailabilityDay[];
  selected?: string | null;
  onSelect?: (date: string) => void;
  interactive?: boolean;
  showLegend?: boolean;
}) {
  const { t } = useLocale();

  const { cells, label } = useMemo(() => {
    if (days.length === 0) return { cells: [] as (AvailabilityDay | null)[], label: "" };
    const first = new Date(`${days[0].date}T00:00:00`);
    const lead = first.getDay();
    const padded: (AvailabilityDay | null)[] = Array.from({ length: lead }, () => null);
    return {
      cells: [...padded, ...days],
      label: monthLabel(first.getFullYear(), first.getMonth(), t),
    };
  }, [days, t]);

  if (days.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("common.scheduleNoData")}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        {showLegend && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{" "}
              {t("common.scheduleOpenDay")}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-muted-foreground" />{" "}
              {t("common.scheduleUnavailable")}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-muted-foreground">
        {DAY_KEYS.map((d) => (
          <div key={d} className="py-1">
            {t(`admin.day.${d}`)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} className="h-14 rounded-md bg-muted/20" />;
          const dayNum = Number(d.date.slice(8, 10));
          const isSelected = selected === d.date;
          const isToday = d.date === dayKey(new Date());
          const booked = (d.bookings || []).length > 0;
          return (
            <button
              key={d.date}
              type="button"
              disabled={!interactive || !d.available}
              onClick={() => d.available && onSelect?.(d.date)}
              title={d.window ? `${d.window.open} – ${d.window.close}` : undefined}
              className={`flex h-14 flex-col items-center justify-center rounded-md border text-sm transition ${
                d.available
                  ? "cursor-pointer border-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50"
                  : "cursor-not-allowed border-border bg-muted/30 text-muted-foreground"
              } ${isSelected ? "ring-2 ring-primary" : ""} ${isToday ? "font-bold" : ""}`}
            >
              <span>{dayNum}</span>
              {booked && (
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

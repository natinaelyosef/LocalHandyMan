"use client";

import type { BookingDetail, TimelineEntry } from "@/app/dashboard/customer/_lib/types";
import { EmptyState, StatusBadge, prettify } from "@/app/dashboard/customer/_lib/ui";
import { History } from "lucide-react";
import { fmtDateTime } from "@/lib/client";
import { useLocale } from "@/context/locale";

const ACTION_KEYS: Record<string, string> = {
  STATUS_CHANGED: "customer.timeline.status_changed",
  BOOKING_CREATED: "customer.timeline.booking_created",
  JOB_PHASE_ADDED: "customer.timeline.job_phase_added",
  JOB_PHASE_UPDATED: "customer.timeline.job_phase_updated",
  PAYMENT_PLAN_UPDATED: "customer.timeline.payment_plan_updated",
};

const ROLE_KEYS: Record<string, string> = {
  customer: "customer.role.customer",
  worker: "customer.role.worker",
  admin: "customer.role.admin",
  system: "customer.role.system",
};

export function TimelineTab({ data }: { data: BookingDetail }) {
  const { t } = useLocale();
  const entries = [...(data.booking.timeline || [])].sort(
    (a: TimelineEntry, b: TimelineEntry) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  if (!entries.length) {
    return (
      <EmptyState icon={History} title={t("customer.timeline.emptyTitle")} message={t("customer.timeline.emptyMsg")} />
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <ol className="relative ml-3 space-y-5 border-l-2 pl-6">
        {entries.map((e, i) => (
          <li key={`${e.at}-${i}`} className="relative">
            <span className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />
            <div className="rounded-xl border bg-background p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {ACTION_KEYS[e.action] ? t(ACTION_KEYS[e.action]) : prettify(e.action)}
                </p>
                <span className="text-xs text-muted-foreground">{fmtDateTime(e.at)}</span>
              </div>
              {(e.from || e.to) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {e.from && <StatusBadge status={e.from} />}
                  <span className="text-muted-foreground">→</span>
                  {e.to && <StatusBadge status={e.to} />}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {e.actorRole && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {ROLE_KEYS[e.actorRole] ? t(ROLE_KEYS[e.actorRole]) : prettify(e.actorRole)}
                  </span>
                )}
              </div>
              {e.note && <p className="mt-2 text-sm text-muted-foreground">{e.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, CalendarDays, Gauge, Search, TriangleAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { WORKER_NAV } from "@/components/dashboard/nav-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { api, etb, fmtDate, statusClass, URGENCY_CLASS } from "@/lib/client";
import { useLocale } from "@/context/locale";
import { EmptyState, ErrorState, useErrMsg, type BookingListItemT } from "../_shared";

type ChipKey = "all" | "active" | "awaiting" | "completed" | "cancelled";

const CHIPS: { key: ChipKey; labelKey: string; statuses: string[] }[] = [
  { key: "all", labelKey: "common.all", statuses: [] },
  {
    key: "active",
    labelKey: "worker.jobs.chipActive",
    statuses: ["PAYMENT_VERIFIED", "SCHEDULED", "WORKER_ON_THE_WAY", "WORK_STARTED", "IN_PROGRESS", "AWAITING_CUSTOMER", "READY_FOR_REVIEW"],
  },
  { key: "awaiting", labelKey: "worker.jobs.chipAwaiting", statuses: ["BOOKING_CONFIRMED", "ADVANCE_PAYMENT_DUE", "PAYMENT_PROOF_SUBMITTED"] },
  { key: "completed", labelKey: "common.status.completed", statuses: ["COMPLETED", "CUSTOMER_CONFIRMED", "CLOSED"] },
  { key: "cancelled", labelKey: "common.status.cancelled", statuses: ["CANCELLED", "REJECTED", "EXPIRED"] },
];

export default function WorkerJobsPage() {
  const { t } = useLocale();
  const errMsg = useErrMsg();
  const [chip, setChip] = useState<ChipKey>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BookingListItemT[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("limit", "10");
      const active = CHIPS.find((c) => c.key === chip);
      if (active && active.statuses.length) sp.set("status", active.statuses.join(","));
      if (debouncedQ) sp.set("q", debouncedQ);
      const d = await api<{
        items: BookingListItemT[];
        total: number;
        pages: number;
        statusCounts: Record<string, number>;
      }>(`/api/bookings?${sp.toString()}`);
      setItems(d.items || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
      setStatusCounts(d.statusCounts || {});
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [errMsg, chip, debouncedQ, page]);

  useEffect(() => {
    load();
  }, [load]);

  const countFor = (chipKey: ChipKey): number => {
    const c = CHIPS.find((x) => x.key === chipKey);
    if (!c) return 0;
    if (c.key === "all") return Object.values(statusCounts).reduce((s, n) => s + n, 0);
    return c.statuses.reduce((s, k) => s + (statusCounts[k] || 0), 0);
  };

  return (
    <DashboardShell role="worker" nav={WORKER_NAV} title={t("nav.myJobs")} subtitle={t("worker.jobs.subtitle")}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {CHIPS.map((c) => {
              const n = countFor(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() => {
                    setChip(c.key);
                    setPage(1);
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    chip === c.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {t(c.labelKey)}
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                      chip === c.key ? "bg-primary-foreground/20" : "bg-muted"
                    }`}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>

          <form
            className="relative w-full lg:w-80"
            onSubmit={(e) => {
              e.preventDefault();
              setDebouncedQ(q.trim());
              setPage(1);
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("worker.jobs.searchPlaceholder")}
              className="pl-9"
            />
          </form>
        </div>

        {loading && (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl border bg-card" />
            ))}
          </div>
        )}

        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon={Briefcase}
            title={
              debouncedQ || chip !== "all" ? t("worker.jobs.emptyFilteredTitle") : t("worker.jobs.emptyTitle")
            }
            hint={
              debouncedQ || chip !== "all" ? t("worker.jobs.emptyFilteredHint") : t("worker.jobs.emptyHint")
            }
            action={
              <div className="flex gap-2">
                {debouncedQ && (
                  <Button variant="outline" size="sm" onClick={() => setQ("")}>
                    {t("worker.jobs.clearSearch")}
                  </Button>
                )}
                <Button asChild size="sm">
                  <Link href="/dashboard/worker/requests">{t("worker.jobs.browseRequests")}</Link>
                </Button>
              </div>
            }
          />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-4">
            {items.map((b) => {
              const summary = b.paymentSummary || { total: b.agreedTotal, verified: 0, pending: 0, remaining: b.agreedTotal };
              return (
                <Card key={b._id}>
                  <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_260px]">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {b.code}
                        </Badge>
                        <Badge className={statusClass(b.status)} variant="secondary">
                          {t(`worker.status.${b.status.toLowerCase()}`)}
                        </Badge>
                        {b.urgency && b.urgency !== "normal" && (
                          <Badge className={URGENCY_CLASS[b.urgency]} variant="secondary">
                            <TriangleAlert className="mr-1 h-3 w-3" />
                            {t(`common.urgency.${b.urgency}`)}
                          </Badge>
                        )}
                      </div>
                      <h3 className="truncate font-semibold">{b.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("worker.jobs.customerLabel", { name: b.customerId?.name || "—" })}
                      </p>

                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {t("worker.jobs.startLabel", {
                            date: b.startDate ? fmtDate(b.startDate) : t("worker.notSetLower"),
                          })}
                        </span>
                        <span>
                          {t("worker.jobs.dueLabel", {
                            date: b.expectedCompletion ? fmtDate(b.expectedCompletion) : t("worker.notSetLower"),
                          })}
                        </span>
                        <span>{t("worker.jobs.bookedLabel", { date: fmtDate(b.createdAt) })}</span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Gauge className="h-3.5 w-3.5" /> {t("worker.jobs.progress")}
                          </span>
                          <span>{b.progressPercent || 0}%</span>
                        </div>
                        <ProgressBar value={b.progressPercent || 0} className="h-2" />
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-3 rounded-lg border bg-muted/30 p-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {t("worker.jobs.agreedTotal")}
                        </p>
                        <p className="text-xl font-bold">{etb(b.agreedTotal)}</p>
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("worker.jobs.verified")}</span>
                            <span className="font-medium text-emerald-700 dark:text-emerald-300">{etb(summary.verified)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("worker.jobs.pending")}</span>
                            <span className="font-medium text-amber-700 dark:text-amber-300">{etb(summary.pending)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("worker.jobs.remaining")}</span>
                            <span className="font-medium">{etb(summary.remaining)}</span>
                          </div>
                        </div>
                      </div>
                      <Button asChild className="w-full" size="sm">
                        <Link href={`/dashboard/worker/jobs/${b._id}`}>{t("worker.jobs.openJob")}</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!loading && !error && pages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              {t("worker.previous")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("worker.jobs.pageOf", { page, pages, total })}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              {t("common.next")}
            </Button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

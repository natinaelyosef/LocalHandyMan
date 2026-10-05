"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, CalendarDays, ChevronDown, Receipt, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { WORKER_NAV } from "@/components/dashboard/nav-config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, etb, fmtDate, fmtDateTime, statusClass } from "@/lib/client";
import { useLocale } from "@/context/locale";
import { EmptyState, ErrorState, PageSkeleton, useErrMsg, type PaymentPhaseT, type PaymentProofT } from "../_shared";

type HistoryBooking = {
  _id: string;
  code: string;
  title: string;
  status: string;
  paymentSummary?: { total: number; verified: number; pending: number; remaining: number };
};

type HistoryRow = {
  phase: PaymentPhaseT;
  booking: HistoryBooking | null;
  proofs: PaymentProofT[];
};

type HistoryResp = {
  rows: HistoryRow[];
  totals: { required: number; verified: number; pending: number; remaining: number };
  account?: { bank?: string; accountName?: string; accountNumber?: string; branch?: string } | null;
  disclaimer?: string;
};

const FILTERS = [
  { value: "all", labelKey: "worker.pay.filterAll" },
  { value: "PAYMENT_DUE", labelKey: "worker.pay.filterDue" },
  { value: "PROOF_SUBMITTED", labelKey: "worker.pay.filterProofSubmitted" },
  { value: "UNDER_VERIFICATION", labelKey: "worker.pay.filterUnderVerification" },
  { value: "VERIFIED", labelKey: "worker.pay.filterVerified" },
  { value: "REJECTED", labelKey: "worker.pay.filterRejected" },
  { value: "UNPAID", labelKey: "worker.pay.filterUnpaid" },
  { value: "CANCELLED", labelKey: "worker.pay.filterCancelled" },
];

function proofStatusClass(status: string): string {
  if (status === "verified") return "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300";
  if (status === "rejected") return "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300";
  return "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300";
}

export default function WorkerPaymentsPage() {
  const { t } = useLocale();
  const errMsg = useErrMsg();
  const [filter, setFilter] = useState("all");
  const [data, setData] = useState<HistoryResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api<HistoryResp>(`/api/payments/history?status=${encodeURIComponent(filter)}`);
      setData(d);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [errMsg, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const groups: { booking: HistoryBooking | null; rows: HistoryRow[] }[] = [];
  if (data) {
    const map = new Map<string, { booking: HistoryBooking | null; rows: HistoryRow[] }>();
    for (const row of data.rows) {
      const key = row.booking?._id || `none-${row.phase._id}`;
      const existing = map.get(key);
      if (existing) existing.rows.push(row);
      else map.set(key, { booking: row.booking, rows: [row] });
    }
    groups.push(...map.values());
  }

  const totals = data?.totals || { required: 0, verified: 0, pending: 0, remaining: 0 };

  return (
    <DashboardShell role="worker" nav={WORKER_NAV} title={t("nav.paymentRecords")} subtitle={t("worker.pay.subtitle")}>
      <div className="mx-auto max-w-7xl space-y-6">
        <Alert>
          <Wallet className="h-4 w-4" />
          <AlertTitle>{t("worker.pay.alertTitle")}</AlertTitle>
          <AlertDescription>{t("worker.pay.alertDesc")}</AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t("worker.jobDetail.totalAgreed"), value: totals.required, cls: "text-foreground", icon: Receipt },
            { label: t("worker.pay.verifiedReceived"), value: totals.verified, cls: "text-emerald-700 dark:text-emerald-300", icon: Banknote },
            { label: t("worker.pay.pendingVerification"), value: totals.pending, cls: "text-amber-700 dark:text-amber-300", icon: Wallet },
            { label: t("worker.pay.outstanding"), value: totals.remaining, cls: "text-foreground", icon: CalendarDays },
          ].map((c) => (
            <Card key={c.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <c.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{c.label}</p>
                  <p className={`text-xl font-bold ${c.cls}`}>{etb(c.value)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full sm:w-64">
            <Label className="mb-1.5 block">{t("worker.pay.filterByStatus")}</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {t(f.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!loading && data && (
            <p className="text-sm text-muted-foreground">
              {data.rows.length === 1
                ? t("worker.pay.phaseCountOne")
                : t("worker.pay.phaseCountMany", { count: data.rows.length })}
            </p>
          )}
        </div>

        {loading && <PageSkeleton rows={3} />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && groups.length === 0 && (
          <EmptyState
            icon={Banknote}
            title={filter === "all" ? t("worker.pay.emptyTitle") : t("worker.pay.emptyFilteredTitle")}
            hint={t("worker.pay.emptyHint")}
            action={
              <div className="flex gap-2">
                {filter !== "all" && (
                  <button
                    onClick={() => setFilter("all")}
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    {t("worker.pay.clearFilter")}
                  </button>
                )}
                <Link href="/dashboard/worker/jobs" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
                  {t("worker.pay.goToJobs")}
                </Link>
              </div>
            }
          />
        )}

        {!loading && !error && groups.length > 0 && (
          <div className="space-y-4">
            {groups.map((g) => {
              const key = g.booking?._id || g.rows[0].phase._id;
              return (
                <Card key={key}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {g.booking && (
                            <Link
                              href={`/dashboard/worker/jobs/${g.booking._id}`}
                              className="font-mono text-sm font-semibold text-primary hover:underline"
                            >
                              {g.booking.code}
                            </Link>
                          )}
                          {g.booking && <span className="text-sm font-medium">{g.booking.title}</span>}
                          {g.booking && (
                            <Badge className={statusClass(g.booking.status)} variant="secondary">
                              {t(`worker.status.${g.booking.status.toLowerCase()}`)}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {g.rows.length === 1 ? t("worker.pay.phaseOne") : t("worker.pay.phaseMany", { count: g.rows.length })} ·{" "}
                          {t("worker.pay.scheduled", { amount: etb(g.rows.reduce((s, r) => s + r.phase.amount, 0)) })}
                        </p>
                      </div>
                    </div>

                    <div className="divide-y rounded-lg border">
                      {g.rows.map((r) => (
                        <div key={r.phase._id} className="p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">
                                {r.phase.order}. {r.phase.label}
                              </span>
                              <Badge className={statusClass(r.phase.status)} variant="secondary">
                                {t(`worker.payStatus.${r.phase.status.toLowerCase()}`)}
                              </Badge>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {t("worker.pay.due", { date: r.phase.dueDate ? fmtDate(r.phase.dueDate) : "—" })}
                              </span>
                            </div>
                            <span className="font-semibold">{etb(r.phase.amount)}</span>
                          </div>

                          {r.proofs.length > 0 ? (
                            <div className="mt-2 space-y-2">
                              {r.proofs.map((pf) => (
                                <div key={pf._id} className="rounded-lg border bg-muted/40 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                    <span className="flex items-center gap-2">
                                      <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="font-mono font-semibold">{pf.reference}</span>
                                      <Badge className={proofStatusClass(pf.status)} variant="secondary">
                                        {t(`common.verification.${pf.status}`)}
                                      </Badge>
                                    </span>
                                    <span className="font-semibold">{etb(pf.amountPaid)}</span>
                                  </div>
                                  <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                                    <span>{t("worker.pay.paidAt", { when: fmtDateTime(pf.paidAt) })}</span>
                                    {pf.createdAt && (
                                      <span>{t("worker.pay.submittedAt", { when: fmtDateTime(pf.createdAt) })}</span>
                                    )}
                                    {pf.reviewedAt && (
                                      <span>{t("worker.pay.reviewedAt", { when: fmtDateTime(pf.reviewedAt) })}</span>
                                    )}
                                    {pf.bank && <span>{pf.bank}</span>}
                                  </div>
                                  {pf.status === "rejected" && pf.rejectionReason && (
                                    <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                                      {t("worker.pay.rejectionReason", { reason: pf.rejectionReason })}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-xs text-muted-foreground">{t("worker.pay.noProofYet")}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {data?.account && (
                      <p className="text-xs text-muted-foreground">
                        {t("worker.pay.paysTo", {
                          bank: data.account.bank || "",
                          name: data.account.accountName || "",
                          number: data.account.accountNumber || "",
                        })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!loading && !error && data && data.rows.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ChevronDown className="h-3.5 w-3.5" />
            {data.disclaimer || t("worker.pay.disclaimer")}
          </p>
        )}
      </div>
    </DashboardShell>
  );
}

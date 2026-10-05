"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Receipt, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { api, etb, fileUrl, fmtDate, fmtDateTime } from "@/lib/client";
import { useLocale } from "@/context/locale";
import type { PaymentAccount, PaymentHistoryRow, PaymentTotals } from "@/app/dashboard/customer/_lib/types";
import { EmptyState, ErrorState, RowsSkeleton, StatusBadge, errText } from "@/app/dashboard/customer/_lib/ui";

const TABS: { key: string; labelKey: string }[] = [
  { key: "all", labelKey: "common.all" },
  { key: "UNPAID", labelKey: "customer.status.unpaid" },
  { key: "PAYMENT_DUE", labelKey: "customer.status.payment_due" },
  { key: "PROOF_SUBMITTED", labelKey: "customer.status.proof_submitted" },
  { key: "UNDER_VERIFICATION", labelKey: "customer.status.under_verification" },
  { key: "VERIFIED", labelKey: "common.verification.verified" },
  { key: "REJECTED", labelKey: "common.verification.rejected" },
];

export default function PaymentsPage() {
  const { t } = useLocale();
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<PaymentHistoryRow[]>([]);
  const [totals, setTotals] = useState<PaymentTotals>({ required: 0, verified: 0, pending: 0, remaining: 0 });
  const [account, setAccount] = useState<PaymentAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api<{ rows: PaymentHistoryRow[]; totals: PaymentTotals; account: PaymentAccount | null }>(
        `/api/payments/history?status=${status}`
      );
      setRows(d.rows || []);
      setTotals(d.totals || { required: 0, verified: 0, pending: 0, remaining: 0 });
      setAccount(d.account || null);
    } catch (e) {
      setError(errText(e, t));
    } finally {
      setLoading(false);
    }
  }, [status, t]);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, { booking: PaymentHistoryRow["booking"]; rows: PaymentHistoryRow[] }>();
    for (const r of rows) {
      const key = r.booking?._id || r.phase._id;
      const entry = map.get(key);
      if (entry) entry.rows.push(r);
      else map.set(key, { booking: r.booking, rows: [r] });
    }
    return Array.from(map.values());
  }, [rows]);

  return (
    <DashboardShell
      role="customer"
      nav={CUSTOMER_NAV}
      title={t("nav.payments")}
      subtitle={t("customer.paymentsPage.subtitle")}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TotalCard label={t("customer.paymentsPage.required")} value={etb(totals.required)} />
          <TotalCard
            label={t("customer.paymentsPage.verified")}
            value={etb(totals.verified)}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <TotalCard
            label={t("customer.paymentsPage.pending")}
            value={etb(totals.pending)}
            tone="text-amber-600 dark:text-amber-400"
          />
          <TotalCard label={t("customer.payments.remaining")} value={etb(totals.remaining)} />
        </div>

        <div className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 p-4 text-sm text-amber-800 dark:text-amber-300">
          <span className="font-semibold">{t("customer.paymentsPage.noteLabel")}</span> {t("customer.paymentsPage.noteBody")}
          {account && (
            <span className="mt-1 block">
              {t("customer.paymentsPage.defaultReceiver")}{" "}
              <span className="font-semibold">{account.accountName}</span> · {account.accountNumber} · {account.bank}
            </span>
          )}
        </div>

        <Tabs value={status} onValueChange={setStatus}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
            {TABS.map((tabItem) => (
              <TabsTrigger key={tabItem.key} value={tabItem.key}>
                {t(tabItem.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={status} className="mt-4 space-y-4">
            {loading && <RowsSkeleton n={3} />}
            {!loading && error && <ErrorState message={error} onRetry={load} />}
            {!loading && !error && groups.length === 0 && (
              <EmptyState
                icon={Receipt}
                title={t("customer.paymentsPage.emptyTitle")}
                message={t("customer.paymentsPage.emptyMsg")}
              >
                <Button asChild variant="outline">
                  <Link href="/dashboard/customer/bookings">{t("customer.paymentsPage.goToBookings")}</Link>
                </Button>
              </EmptyState>
            )}

            {!loading && !error &&
              groups.map((g) => (
                <section key={g.booking?._id || g.rows[0]?.phase._id} className="overflow-hidden rounded-xl border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{g.booking?.title || t("customer.bookingTitle")}</p>
                      <p className="text-xs text-muted-foreground">{g.booking?.code || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {g.booking?.status && <StatusBadge status={g.booking.status} />}
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/dashboard/customer/bookings/${g.booking?._id}`}>
                          {t("customer.paymentsPage.openBooking")} <ArrowUpRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="divide-y">
                    {g.rows.map((r) => (
                      <div key={r.phase._id} className="p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {r.phase.order}
                          </span>
                          <span className="font-medium">{r.phase.label}</span>
                          <span className="text-sm text-muted-foreground">{etb(r.phase.amount)}</span>
                          <span className="ml-auto">
                            <StatusBadge status={r.phase.status} />
                          </span>
                        </div>

                        {r.phase.status === "REJECTED" && r.phase.rejectionReason && (
                          <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                            {t("customer.payments.rejectedWith", { reason: r.phase.rejectionReason })}
                          </p>
                        )}

                        {r.proofs.length > 0 && (
                          <ul className="mt-3 space-y-2">
                            {r.proofs.map((p) => (
                              <li key={p._id} className="flex flex-wrap items-start gap-3 rounded-lg border bg-muted/30 p-3">
                                <a
                                  href={fileUrl(p.screenshotFileId)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block h-14 w-16 shrink-0 overflow-hidden rounded-md border bg-background"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={fileUrl(p.screenshotFileId)}
                                    alt={t("customer.payments.screenshotAlt")}
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                                <div className="min-w-0 flex-1 text-sm">
                                  <p className="flex flex-wrap items-center gap-2 font-medium">
                                    {p.reference}
                                    <StatusBadge status={p.status === "pending" ? "PENDING" : p.status.toUpperCase()} />
                                  </p>
                                  <p className="text-muted-foreground">
                                    {t("customer.paymentsPage.paidLine", {
                                      amount: etb(p.amountPaid),
                                      date: fmtDate(p.paidAt),
                                    })}
                                    {p.reviewedAt
                                      ? ` · ${t("customer.paymentsPage.reviewedLine", { date: fmtDateTime(p.reviewedAt) })}`
                                      : ""}
                                  </p>
                                  <p className="text-muted-foreground">{p.senderName}</p>
                                  {p.rejectionReason && (
                                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                      {t("customer.payments.reason", { reason: p.rejectionReason })}
                                    </p>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardShell>
  );
}

function TotalCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Wallet className="h-3.5 w-3.5" /> {label}
      </p>
      <p className={`mt-1 text-xl font-bold ${tone || ""}`}>{value}</p>
    </div>
  );
}

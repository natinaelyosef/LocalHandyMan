"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, PlusCircle, Search, Wallet } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api, etb, fmtDate } from "@/lib/client";
import { useLocale } from "@/context/locale";
import type { BookingLite } from "@/app/dashboard/customer/_lib/types";
import { ravatar, rid, rname } from "@/app/dashboard/customer/_lib/types";
import { EmptyState, ErrorState, RowsSkeleton, StatusBadge, errText } from "@/app/dashboard/customer/_lib/ui";

type Chip = { key: string; labelKey: string; status?: string; paymentDue?: boolean };

const ACTIVE =
  "BOOKING_CONFIRMED,ADVANCE_PAYMENT_DUE,PAYMENT_PROOF_SUBMITTED,PAYMENT_VERIFIED,SCHEDULED,WORKER_ON_THE_WAY,WORK_STARTED,IN_PROGRESS,AWAITING_CUSTOMER,READY_FOR_REVIEW";

const CHIPS: Chip[] = [
  { key: "all", labelKey: "common.all" },
  { key: "active", labelKey: "customer.bookings.chipActive", status: ACTIVE },
  { key: "due", labelKey: "customer.status.payment_due", paymentDue: true },
  { key: "completed", labelKey: "common.status.completed", status: "COMPLETED,CUSTOMER_CONFIRMED,CLOSED" },
  { key: "cancelled", labelKey: "common.status.cancelled", status: "CANCELLED,REJECTED" },
];

const LIMIT = 12;

export default function MyBookingsPage() {
  const { t } = useLocale();
  const [chip, setChip] = useState("all");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<BookingLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeChip = CHIPS.find((c) => c.key === chip) || CHIPS[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (activeChip.status) sp.set("status", activeChip.status);
      if (query) sp.set("q", query);
      const d = await api<{ items: BookingLite[]; total: number; pages: number }>(`/api/bookings?${sp.toString()}`);
      let list = d.items || [];
      if (activeChip.paymentDue) list = list.filter((b) => (b.paymentSummary?.pending || 0) > 0);
      setItems(list);
      setPages(d.pages || 1);
      setTotal(d.total || 1);
    } catch (e) {
      setError(errText(e, t));
    } finally {
      setLoading(false);
    }
  }, [page, activeChip, query, t]);

  useEffect(() => {
    load();
  }, [load]);

  const pickChip = (key: string) => {
    setChip(key);
    setPage(1);
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(q.trim());
  };

  return (
    <DashboardShell
      role="customer"
      nav={CUSTOMER_NAV}
      title={t("nav.myBookings")}
      subtitle={t("customer.bookings.subtitle")}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => pickChip(c.key)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  chip === c.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(c.labelKey)}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <form onSubmit={search} className="flex gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("customer.bookings.searchPlaceholder")}
                className="w-full lg:w-64"
              />
              <Button type="submit" variant="outline" size="icon" aria-label={t("common.search")}>
                <Search className="h-4 w-4" />
              </Button>
            </form>
            <Button asChild>
              <Link href="/dashboard/customer/requests/new">
                <PlusCircle className="mr-2 h-4 w-4" /> {t("nav.newRequest")}
              </Link>
            </Button>
          </div>
        </div>

        {loading && <RowsSkeleton n={5} />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon={CalendarCheck}
            title={query || chip !== "all" ? t("customer.bookings.emptyFilterTitle") : t("customer.bookings.emptyTitle")}
            message={query || chip !== "all" ? t("customer.bookings.emptyFilterMsg") : t("customer.bookings.emptyMsg")}
          >
            <Button asChild>
              <Link href="/dashboard/customer/requests/new">
                <PlusCircle className="mr-2 h-4 w-4" /> {t("nav.newRequest")}
              </Link>
            </Button>
          </EmptyState>
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((b) => {
                const ps = b.paymentSummary || { total: 0, verified: 0, pending: 0, remaining: 0 };
                const paidPct = ps.total > 0 ? Math.round((ps.verified / ps.total) * 100) : 0;
                return (
                  <Link
                    key={b._id}
                    href={`/dashboard/customer/bookings/${rid(b)}`}
                    className="flex flex-col rounded-xl border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {b.code}
                      </Badge>
                      <StatusBadge status={b.status} />
                      <span className="ml-auto text-xs text-muted-foreground">{fmtDate(b.createdAt)}</span>
                    </div>

                    <h3 className="mt-3 line-clamp-2 font-semibold">{b.title}</h3>

                    <div className="mt-3 flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={ravatar(b.workerId)} alt={rname(b.workerId)} />
                        <AvatarFallback>{(rname(b.workerId) || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">{rname(b.workerId, t("customer.workerLabel"))}</span>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t("customer.bookings.workProgress")}</span>
                          <span>{b.progressPercent || 0}%</span>
                        </div>
                        <Progress value={b.progressPercent || 0} className="h-2" />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Wallet className="h-3.5 w-3.5" /> {t("customer.bookings.paid")}
                          </span>
                          <span>
                            {etb(ps.verified)} / {etb(ps.total)}
                          </span>
                        </div>
                        <Progress value={paidPct} className="h-2 bg-muted" />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {t("customer.bookings.agreedTotal")}
                        </p>
                        <p className="font-semibold">{etb(b.agreedTotal)}</p>
                      </div>
                      <span className="text-sm font-medium text-primary">{t("customer.openArrow")}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t("customer.previous")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("customer.bookings.pageOf", { page, pages, total })}
                </span>
                <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  {t("common.next")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

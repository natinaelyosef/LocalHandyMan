"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, RefreshCw, Search } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, etb, fmtDate, URGENCY_CLASS } from "@/lib/client";
import { BOOKING_STATUSES, TERMINAL_BOOKING_STATUSES } from "@/lib/constants";
import { useLocale } from "@/context/locale";
import { EmptyState, ErrorAlert, Pagination, StatusPill, TableSkeleton, qs, useStatusLabel } from "../_shared";

interface Party {
  _id: string;
  name: string;
  phone: string;
}

interface BookingRow {
  _id: string;
  code: string;
  title: string;
  status: string;
  urgency: string;
  agreedTotal: number;
  createdAt: string;
  startDate?: string | null;
  expectedCompletion?: string | null;
  progressPercent: number;
  reviewed: boolean;
  disputeOpen: boolean;
  customerId: Party | string;
  workerId: Party | string;
  categoryId: { _id: string; name: string } | string | null;
  paymentSummary?: { total: number; verified: number; pending: number; remaining: number };
}

interface BookingsResp {
  items: BookingRow[];
  total: number;
  pages: number;
  statusCounts: Record<string, number>;
}

const ACTIVE_STATUSES = BOOKING_STATUSES.filter((s) => !TERMINAL_BOOKING_STATUSES.includes(s)).join(",");

function nameOf(v: Party | string | null | undefined): string {
  return typeof v === "object" && v ? v.name : "—";
}
function phoneOf(v: Party | string | null | undefined): string {
  return typeof v === "object" && v ? v.phone || "" : "";
}
function catOf(v: BookingRow["categoryId"]): string {
  return typeof v === "object" && v ? v.name : "—";
}

export default function AdminBookingsPage() {
  const { t } = useLocale();
  const label = useStatusLabel();
  const [status, setStatus] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<BookingsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    const valid = s === "active" || (s && BOOKING_STATUSES.includes(s as never));
    setStatus(valid ? (s as string) : "all");
  }, []);

  useEffect(() => {
    if (status === null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    const statusParam = status === "all" ? "" : status === "active" ? ACTIVE_STATUSES : status;
    api<BookingsResp>(`/api/bookings${qs({ all: 1, status: statusParam, q, page, limit: 12 })}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t("admin.errors.loadBookings"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page, q]);

  const reload = () => {
    setLoading(true);
    setError("");
    const statusParam = status === "all" || status === null ? "" : status === "active" ? ACTIVE_STATUSES : status;
    api<BookingsResp>(`/api/bookings${qs({ all: 1, status: statusParam, q, page, limit: 12 })}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("admin.errors.loadBookings")))
      .finally(() => setLoading(false));
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  };

  const counts = data?.statusCounts || {};
  const totalActive = Object.entries(counts)
    .filter(([k]) => !TERMINAL_BOOKING_STATUSES.includes(k as never))
    .reduce((a, [, n]) => a + n, 0);

  return (
    <DashboardShell
      role="admin"
      nav={ADMIN_NAV}
      title={t("nav.bookings")}
      subtitle={t("admin.bookings.subtitle")}
    >
      <div className="max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status ?? "all"}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder={t("admin.bookings.filterByStatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.allStatuses")}</SelectItem>
                <SelectItem value="active">
                  {t("admin.bookings.activeFilter")} {totalActive ? `· ${totalActive}` : ""}
                </SelectItem>
                {BOOKING_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {label(s)} {counts[s] !== undefined ? `· ${counts[s]}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {data ? t("admin.bookings.count", { n: data.total }) : ""}
            </span>
          </div>

          <form onSubmit={onSearch} className="flex gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("admin.bookings.searchPlaceholder")}
              className="w-full lg:w-72"
            />
            <Button type="submit" variant="outline">
              <Search className="mr-1.5 h-4 w-4" /> {t("common.search")}
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={reload} aria-label={t("common.refresh")}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {error && <ErrorAlert error={error} onRetry={reload} />}

        {loading && !data ? (
          <TableSkeleton rows={8} cols={8} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title={q ? t("admin.bookings.noMatchTitle") : t("admin.bookings.emptyTitle")}
            desc={q ? t("admin.bookings.noMatchDesc", { q }) : t("admin.bookings.emptyDesc")}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.bookings.hCode")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.bookings.hTitle")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.bookings.hCustomer")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.bookings.hWorker")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.bookings.hCategory")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.bookings.hStatus")}</TableHead>
                  <TableHead className="text-right text-sm font-medium text-muted-foreground">{t("admin.bookings.hAgreedTotal")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.bookings.hPayments")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.bookings.hCreated")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.bookings.hUrgency")}</TableHead>
                  <TableHead className="text-right text-sm font-medium text-muted-foreground">{t("admin.bookings.hAction")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((b) => {
                  const sum = b.paymentSummary;
                  const pct = sum && sum.total > 0 ? Math.round((sum.verified / sum.total) * 100) : 0;
                  return (
                    <TableRow key={b._id}>
                      <TableCell className="font-mono text-xs">{b.code}</TableCell>
                      <TableCell className="max-w-[220px]">
                        <p className="truncate font-medium" title={b.title}>
                          {b.title}
                        </p>
                        {b.disputeOpen && (
                          <span className="text-xs font-medium text-red-600 dark:text-red-400">{t("admin.bookings.disputeOpen")}</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        <span>{nameOf(b.customerId)}</span>
                        {phoneOf(b.customerId) && (
                          <span className="block text-xs text-muted-foreground">{phoneOf(b.customerId)}</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        <span>{nameOf(b.workerId)}</span>
                        {phoneOf(b.workerId) && (
                          <span className="block text-xs text-muted-foreground">{phoneOf(b.workerId)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{catOf(b.categoryId)}</TableCell>
                      <TableCell>
                        <StatusPill status={b.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm font-medium">
                        {etb(b.agreedTotal)}
                      </TableCell>
                      <TableCell className="w-36">
                        {sum && sum.total > 0 ? (
                          <div className="space-y-1">
                            <p className="text-xs">
                              <span className="font-medium text-emerald-600 dark:text-emerald-400">{etb(sum.verified)}</span>
                              <span className="text-muted-foreground"> / {etb(sum.total)}</span>
                            </p>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {fmtDate(b.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            URGENCY_CLASS[b.urgency] || "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {label(b.urgency)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/admin/bookings/${b._id}`}>
                            {t("admin.view")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.items.length > 0 && (
          <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} busy={loading} />
        )}
      </div>
    </DashboardShell>
  );
}

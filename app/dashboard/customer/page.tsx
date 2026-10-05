"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  PlusCircle,
  Search,
  UserCircle,
  Wallet,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api, etb, fmtDate, timeAgo } from "@/lib/client";
import { useAuth } from "@/context/auth";
import { useLocale } from "@/context/locale";
import type { BookingDetail, BookingLite, ServiceRequest } from "@/app/dashboard/customer/_lib/types";
import { ravatar, rid, rname } from "@/app/dashboard/customer/_lib/types";
import { EmptyState, ErrorState, RowsSkeleton, StatCard, StatusBadge, errText } from "@/app/dashboard/customer/_lib/ui";

const TERMINAL = ["CLOSED", "CANCELLED", "REJECTED", "EXPIRED"];
const DONE = ["COMPLETED", "CUSTOMER_CONFIRMED", "CLOSED"];

export default function CustomerOverviewPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [bookings, setBookings] = useState<BookingLite[]>([]);
  const [due, setDue] = useState<{ bookingId: string; code: string; label: string; amount: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r, b] = await Promise.all([
        api<{ items: ServiceRequest[] }>("/api/requests?view=mine&limit=50"),
        api<{ items: BookingLite[] }>("/api/bookings?limit=50"),
      ]);
      const items = b.items || [];
      setRequests(r.items || []);
      setBookings(items);
      setDue(null);
      const pending = items.find((x) => (x.paymentSummary?.pending || 0) > 0);
      if (pending) {
        try {
          const d = await api<BookingDetail>(`/api/bookings/${pending._id}`);
          const ph = (d.paymentPhases || []).find(
            (p) => p.status === "PAYMENT_DUE" || p.status === "UNPAID"
          );
          if (ph) setDue({ bookingId: pending._id, code: pending.code, label: ph.label, amount: ph.amount });
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      setError(errText(e, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const active = bookings.filter((b) => !TERMINAL.includes(b.status)).length;
  const quoted = requests.filter((r) => r.status === "quoted").length;
  const pendingPay = bookings.filter((b) => (b.paymentSummary?.pending || 0) > 0).length;
  const completed = bookings.filter((b) => DONE.includes(b.status)).length;
  const recent = bookings.slice(0, 6);

  const quickActions = [
    { href: "/dashboard/customer/requests/new", label: t("nav.newRequest"), icon: PlusCircle },
    { href: "/find-workers", label: t("nav.findWorkers"), icon: Search },
    { href: "/dashboard/customer/messages", label: t("nav.messages"), icon: MessageSquare },
    { href: "/dashboard/customer/payments", label: t("nav.payments"), icon: Wallet },
  ];

  return (
    <DashboardShell
      role="customer"
      nav={CUSTOMER_NAV}
      title={t("nav.overview")}
      subtitle={user ? t("customer.overview.welcomeBack", { name: user.name.split(" ")[0] }) : undefined}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((qa) => (
            <Button key={qa.href} asChild variant="outline" className="h-auto justify-start gap-3 py-4">
              <Link href={qa.href}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <qa.icon className="h-4 w-4" />
                </span>
                <span className="font-medium">{qa.label}</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </Link>
            </Button>
          ))}
        </div>

        {loading && <RowsSkeleton n={3} />}

        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={CalendarCheck} label={t("customer.overview.activeBookings")} value={active} hint={t("customer.overview.activeBookingsHint")} />
              <StatCard icon={ClipboardList} label={t("customer.overview.pendingQuotations")} value={quoted} hint={t("customer.overview.pendingQuotationsHint")} />
              <StatCard icon={Wallet} label={t("customer.overview.pendingPayments")} value={pendingPay} hint={t("customer.overview.pendingPaymentsHint")} />
              <StatCard icon={CheckCircle2} label={t("customer.overview.completedJobs")} value={completed} hint={t("customer.overview.completedJobsHint")} />
            </div>

            {due && (
              <div className="flex flex-col gap-4 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-200">
                      {t("customer.overview.payDueTitle", { code: due.code })}
                    </p>
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      {t("customer.overview.payDueBody", { label: due.label, amount: etb(due.amount) })}
                    </p>
                  </div>
                </div>
                <Button asChild className="shrink-0">
                  <Link href={`/dashboard/customer/bookings/${due.bookingId}?tab=payments`}>
                    {t("customer.overview.payNow")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}

            <section className="rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold sm:text-base">{t("customer.overview.recentBookings")}</h2>
                  <p className="text-xs text-muted-foreground">{t("customer.overview.recentBookingsHint")}</p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/customer/bookings">
                    {t("common.viewAll")} <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {recent.length === 0 ? (
                <div className="p-4 sm:p-5">
                  <EmptyState
                    icon={CalendarCheck}
                    title={t("customer.overview.noBookings")}
                    message={t("customer.overview.noBookingsHint")}
                  >
                    <Button asChild>
                      <Link href="/dashboard/customer/requests/new">
                        <PlusCircle className="mr-2 h-4 w-4" /> {t("nav.newRequest")}
                      </Link>
                    </Button>
                  </EmptyState>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("customer.bookingTitle")}</TableHead>
                        <TableHead>{t("customer.workerLabel")}</TableHead>
                        <TableHead>{t("common.status")}</TableHead>
                        <TableHead className="w-48">{t("customer.overview.progress")}</TableHead>
                        <TableHead className="text-right">{t("common.total")}</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recent.map((b) => (
                        <TableRow key={b._id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-medium">{b.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {b.code} · {timeAgo(b.createdAt)}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={ravatar(b.workerId)} alt={rname(b.workerId)} />
                                <AvatarFallback>{(rname(b.workerId) || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{rname(b.workerId, "—")}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={b.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={b.progressPercent || 0} className="h-2 flex-1" />
                              <span className="w-9 text-right text-xs text-muted-foreground">
                                {b.progressPercent || 0}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">{etb(b.agreedTotal)}</TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/dashboard/customer/bookings/${rid(b)}`}>{t("customer.open")}</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 sm:p-5">
                <h3 className="text-sm font-semibold">{t("nav.myRequests")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {requests.length === 0
                    ? t("customer.overview.noRequestsYet")
                    : t("customer.overview.requestsCount", { n: requests.length })}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href="/dashboard/customer/requests">
                      <ClipboardList className="mr-2 h-4 w-4" /> {t("nav.myRequests")}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/customer/requests/new">
                      <PlusCircle className="mr-2 h-4 w-4" /> {t("nav.newRequest")}
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 sm:p-5">
                <h3 className="text-sm font-semibold">{t("customer.overview.account")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("customer.overview.accountHint")}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/customer/profile">
                      <UserCircle className="mr-2 h-4 w-4" /> {t("customer.manageProfile")}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/customer/favorites">
                      <UserCircle className="mr-2 h-4 w-4" /> {t("customer.savedWorkers")}
                    </Link>
                  </Button>
                </div>
              </div>
            </section>

            <p className="text-center text-xs text-muted-foreground">
              {t("customer.overview.lastUpdated", { date: fmtDate(new Date()) })} ·{" "}
              <Link className="underline" href="/dashboard/customer/profile">
                {t("customer.profileAddresses")}
              </Link>
            </p>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

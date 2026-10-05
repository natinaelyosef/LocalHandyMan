"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Banknote,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  HardHat,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, etb, timeAgo } from "@/lib/client";
import { useAuth } from "@/context/auth";
import { useLocale } from "@/context/locale";
import { ErrorAlert, StatusPill, useStatusLabel, type AdminStats, type AuditItem } from "./_shared";

const PIE_COLORS: Record<string, string> = {
  REQUESTED: "#94a3b8",
  QUOTATION_SENT: "#6366f1",
  QUOTATION_ACCEPTED: "#818cf8",
  BOOKING_CONFIRMED: "#3b82f6",
  ADVANCE_PAYMENT_DUE: "#f59e0b",
  PAYMENT_PROOF_SUBMITTED: "#fbbf24",
  PAYMENT_VERIFIED: "#10b981",
  SCHEDULED: "#0ea5e9",
  WORKER_ON_THE_WAY: "#06b6d4",
  WORK_STARTED: "#0891b2",
  IN_PROGRESS: "#14b8a6",
  AWAITING_CUSTOMER: "#8b5cf6",
  READY_FOR_REVIEW: "#a78bfa",
  COMPLETED: "#22c55e",
  CUSTOMER_CONFIRMED: "#16a34a",
  CLOSED: "#64748b",
  CANCELLED: "#ef4444",
  REJECTED: "#dc2626",
  DISPUTED: "#b91c1c",
  EXPIRED: "#cbd5e1",
};
const FALLBACK_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#06b6d4", "#94a3b8"];

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
  danger,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  danger?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 shrink-0 ${danger ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}`} />
      </div>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${danger ? "text-red-600 dark:text-red-400" : ""}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block rounded-lg transition-colors hover:bg-accent">
        <Card className={danger ? "border-red-300 dark:border-red-900 bg-red-50/60 dark:bg-red-950/60 py-4" : "py-4"}>{body}</Card>
      </Link>
    );
  }
  return <Card className={danger ? "border-red-300 dark:border-red-900 bg-red-50/60 dark:bg-red-950/60 py-4" : "py-4"}>{body}</Card>;
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[280px] w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const label = useStatusLabel();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api<AdminStats>("/api/admin/stats");
      setStats(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.errors.stats"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = stats?.totals;
  const charts = stats?.charts;

  const categoryData = (charts?.byCategory || []).map((c) => ({
    name: c.name || c._id || t("admin.other"),
    n: c.n,
  }));

  const statusData = (charts?.byStatus || []).map((s) => ({
    name: label(s._id),
    value: s.n,
    raw: s._id,
  }));

  const monthlyData = (charts?.monthly || []).map((m) => ({
    label: `${m._id.m}/${m._id.y}`,
    bookings: m.n,
    completed: m.completed,
  }));

  const attention = totals
    ? [
        {
          label: t("admin.dashboard.attentionPendingWorkers"),
          value: totals.pendingWorkers,
          href: "/dashboard/admin/workers?status=pending",
          icon: HardHat,
          warn: totals.pendingWorkers > 0,
        },
        {
          label: t("admin.dashboard.attentionPendingProofs"),
          value: totals.pendingProofs,
          href: "/dashboard/admin/payments",
          icon: FileSearch,
          warn: totals.pendingProofs > 0,
        },
        {
          label: t("admin.dashboard.attentionDisputed"),
          value: totals.disputedBookings,
          href: "/dashboard/admin/bookings?status=DISPUTED",
          icon: AlertTriangle,
          warn: totals.disputedBookings > 0,
        },
        {
          label: t("admin.dashboard.attentionOpenRequests"),
          value: totals.openRequests,
          href: "",
          icon: ClipboardList,
          warn: false,
        },
      ]
    : [];

  const recent: AuditItem[] = stats?.recentAudit || [];

  return (
    <DashboardShell
      role="admin"
      nav={ADMIN_NAV}
      title={t("admin.dashboard.title")}
      subtitle={user ? t("admin.dashboard.welcome", { name: user.name }) : t("admin.dashboard.overview")}
    >
      <div className="max-w-7xl space-y-6">
        {error && <ErrorAlert error={error} onRetry={load} />}

        {loading && !stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="py-4">
                  <CardContent className="space-y-2 px-4">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartSkeleton />
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          </div>
        ) : (
          stats &&
          totals && (
            <>
              {/* stat cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={Users}
                  label={t("admin.stat.totalCustomers")}
                  value={totals.totalCustomers}
                  sub={t("admin.stat.joined30", { n: totals.last30Users })}
                />
                <StatCard
                  icon={Users}
                  label={t("admin.stat.totalWorkers")}
                  value={totals.totalWorkers}
                  sub={t("admin.stat.suspendedRejected", { n: totals.suspendedWorkers })}
                />
                <StatCard
                  icon={CheckCircle2}
                  label={t("admin.stat.verifiedWorkers")}
                  value={totals.verifiedWorkers}
                  sub={t("admin.stat.pendingVerification", { n: totals.pendingWorkers })}
                  href="/dashboard/admin/workers?status=pending"
                />
                <StatCard
                  icon={CalendarCheck}
                  label={t("admin.stat.activeBookings")}
                  value={totals.activeBookings}
                  sub={t("admin.stat.disputedCount", { n: totals.disputedBookings })}
                />
                <StatCard
                  icon={CheckCircle2}
                  label={t("admin.stat.completedBookings")}
                  value={totals.completedBookings}
                  sub={t("admin.stat.openConversations", { n: totals.openConversations })}
                />
                <StatCard
                  icon={XCircle}
                  label={t("admin.stat.cancelledBookings")}
                  value={totals.cancelledBookings}
                  sub={t("admin.stat.cancelRate", { n: totals.cancellationRate })}
                />
                <StatCard
                  icon={FileSearch}
                  label={t("admin.stat.pendingProofs")}
                  value={totals.pendingProofs}
                  sub={
                    totals.pendingProofs > 0
                      ? t("admin.stat.reviewNow")
                      : t("admin.stat.verifiedRejected", {
                          verified: totals.verifiedProofs,
                          rejected: totals.rejectedProofs,
                        })
                  }
                  href="/dashboard/admin/payments"
                  danger={totals.pendingProofs > 0}
                />
                <StatCard
                  icon={Banknote}
                  label={t("admin.stat.verifiedAmount")}
                  value={etb(totals.verifiedAmount)}
                  sub={t("admin.stat.pendingAmount", { amount: etb(totals.pendingAmount) })}
                />
              </div>

              {/* charts */}
              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">{t("admin.chart.byCategory")}</CardTitle>
                    <CardDescription>{t("admin.chart.byCategoryDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[280px] pt-2">
                    {categoryData.length === 0 ? (
                      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        {t("admin.chart.noData")}
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryData} margin={{ top: 8, right: 8, left: -18, bottom: 32 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip cursor={{ fill: "rgba(99,102,241,0.08)" }} />
                          <Bar dataKey="n" name={t("admin.chart.bookings")} fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">{t("admin.chart.byStatus")}</CardTitle>
                    <CardDescription>{t("admin.chart.byStatusDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[280px] pt-2">
                    {statusData.length === 0 ? (
                      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        {t("admin.chart.noData")}
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={52}
                            outerRadius={84}
                            paddingAngle={2}
                            isAnimationActive={false}
                          >
                            {statusData.map((entry, i) => (
                              <Cell
                                key={entry.raw}
                                fill={PIE_COLORS[entry.raw] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend
                            verticalAlign="bottom"
                            height={60}
                            wrapperStyle={{ fontSize: 11 }}
                            formatter={(value) => String(value)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">{t("admin.chart.monthly")}</CardTitle>
                    <CardDescription>{t("admin.chart.monthlyDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[280px] pt-2">
                    {monthlyData.length === 0 ? (
                      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        {t("admin.chart.noData")}
                      </p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlyData} margin={{ top: 8, right: 8, left: -18, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line type="monotone" dataKey="bookings" name={t("admin.chart.created")} stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="completed" name={t("admin.chart.completed")} stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* panels */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" /> {t("admin.dashboard.needsAttention")}
                    </CardTitle>
                    <CardDescription>{t("admin.dashboard.needsAttentionDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {attention.map((a) => {
                      const inner = (
                        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-accent">
                          <div className="flex min-w-0 items-center gap-3">
                            <a.icon className={`h-4 w-4 shrink-0 ${a.warn ? "text-red-500 dark:text-red-400" : "text-muted-foreground"}`} />
                            <span className="truncate text-sm">{a.label}</span>
                          </div>
                          <span className={`text-sm font-semibold ${a.warn ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{a.value}</span>
                        </div>
                      );
                      return a.href ? (
                        <Link key={a.label} href={a.href} className="block">
                          {inner}
                        </Link>
                      ) : (
                        <div key={a.label}>{inner}</div>
                      );
                    })}
                    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <HardHat className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm">{t("admin.dashboard.suspendedWorkers")}</span>
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">{totals.suspendedWorkers}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
                      <span className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-muted-foreground" /> {t("admin.dashboard.recentActivity")}
                      </span>
                      <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                        <Link href="/dashboard/admin/audit">{t("admin.dashboard.viewAuditLog")}</Link>
                      </Button>
                    </CardTitle>
                    <CardDescription>{t("admin.dashboard.recentActivityDesc")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {recent.length === 0 && (
                      <p className="py-6 text-center text-sm text-muted-foreground">{t("admin.dashboard.noRecentActivity")}</p>
                    )}
                    {recent.map((a) => (
                      <div key={a._id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{a.summary || label(a.action)}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {a.actorName || t("admin.actor.system")} · {a.actorRole ? label(a.actorRole) : t("admin.actor.system")}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <StatusPill status={a.action} />
                          <span className="text-[11px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )
        )}
      </div>
    </DashboardShell>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  Download,
  FileSearch,
  HardHat,
  Loader2,
  RefreshCw,
  Scale,
  Timer,
  TrendingUp,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, etb, fmtDate } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { ErrorAlert, ListSkeleton, StatusPill, qs, useStatusLabel } from "../_shared";

type Summary = {
  range: { from: string; to: string };
  bookings: {
    total: number;
    totalValue: number;
    byStatus: { status: string; n: number; value: number }[];
    byCategory: { name: string; n: number; value: number }[];
    byUrgency: Record<string, number>;
    daily: { _id: string; n: number; completed: number }[];
  };
  verification: {
    totalWorkers: number;
    byStatus: Record<string, number>;
    pendingDocuments: number;
    pendingDocAge: { avgAgeHours: number; oldestAgeHours: number } | null;
  };
  proofs: {
    total: number;
    byStatus: Record<string, number>;
    pending: {
      n: number;
      avgAgeHours: number;
      oldestAgeHours: number;
      over24h: number;
      over72h: number;
    } | null;
    reviewLagHours: number | null;
    reviewed: number;
  };
  pipeline: {
    quotations: Record<string, number>;
    requests: Record<string, number>;
    disputes: Record<string, number>;
    openDisputes: number;
  };
  topWorkers: { workerId: string; name: string; jobs: number; value: number }[];
};

function isoDay(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function hours(n?: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n < 48) return `${n}h`;
  return `${Math.round(n / 24)}d`;
}

export default function AdminReportsPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const label = useStatusLabel();

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return isoDay(d);
  });
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [applied, setApplied] = useState({ from: "", to: "" });
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api<Summary>(`/api/admin/reports${qs({ from: applied.from, to: applied.to })}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("common.error")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);

  useEffect(() => {
    load();
  }, [load]);

  // Default the applied range on first render.
  useEffect(() => {
    setApplied({ from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const download = async (report: "bookings" | "verification" | "proofs") => {
    setDownloading(report);
    try {
      const search = new URLSearchParams({
        report,
        format: "csv",
        from: applied.from,
        to: applied.to,
      });
      const res = await fetch(`/api/admin/reports?${search.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = match ? match[1] : `${report}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: t("admin.reports.downloaded"), description: a.download });
    } catch (e) {
      toast({
        title: t("admin.reports.downloadFailed"),
        description: e instanceof Error ? e.message : t("common.retry"),
        variant: "destructive",
      });
    } finally {
      setDownloading("");
    }
  };

  const proofs = data?.proofs;
  const pendingProofs = proofs?.pending;
  const verificationAge = data?.verification.pendingDocAge;
  const maxDaily = Math.max(1, ...(data?.bookings.daily || []).map((d) => d.n));

  return (
    <DashboardShell
      role="admin"
      nav={ADMIN_NAV}
      title={t("admin.reports.title")}
      subtitle={t("admin.reports.subtitle")}
    >
      <div className="max-w-7xl space-y-6">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="rep-from">{t("admin.reports.from")}</Label>
              <Input
                id="rep-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rep-to">{t("admin.reports.to")}</Label>
              <Input
                id="rep-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>
            <Button
              onClick={() => setApplied({ from, to })}
              disabled={loading || !from || !to}
            >
              <CalendarRange className="mr-1.5 h-4 w-4" /> {t("admin.reports.apply")}
            </Button>
            <Button variant="ghost" onClick={load} aria-label={t("common.refresh")}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {data && (
              <p className="ml-auto text-xs text-muted-foreground">
                {fmtDate(data.range.from)} – {fmtDate(data.range.to)}
              </p>
            )}
          </CardContent>
        </Card>

        {error && <ErrorAlert error={error} onRetry={load} />}

        {loading && !data ? (
          <ListSkeleton rows={4} />
        ) : data ? (
          <>
            {/* bottlenecks */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <FileSearch className="h-4 w-4" /> {t("admin.reports.proofQueue")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-2xl font-bold">{pendingProofs?.n || 0}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.reports.pendingProofs")}
                  </p>
                  {pendingProofs && pendingProofs.n > 0 && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">{t("admin.reports.oldest")}: </span>
                      {hours(pendingProofs.oldestAgeHours)}
                    </p>
                  )}
                  {pendingProofs && pendingProofs.over72h > 0 && (
                    <Badge variant="destructive" className="mt-1">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      {t("admin.reports.over72h", { n: pendingProofs.over72h })}
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Timer className="h-4 w-4" /> {t("admin.reports.proofTurnaround")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-2xl font-bold">{hours(proofs?.reviewLagHours)}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.reports.avgTurnaround")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.reports.reviewedCount", { n: proofs?.reviewed || 0 })}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <HardHat className="h-4 w-4" /> {t("admin.reports.verificationQueue")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-2xl font-bold">{data.verification.pendingDocuments}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.reports.pendingDocs")}</p>
                  {verificationAge && (
                    <p className="text-xs">
                      <span className="text-muted-foreground">{t("admin.reports.oldest")}: </span>
                      {hours(verificationAge.oldestAgeHours)}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Scale className="h-4 w-4" /> {t("admin.reports.disputeQueue")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-2xl font-bold">{data.pipeline.openDisputes}</p>
                  <p className="text-xs text-muted-foreground">{t("admin.reports.openDisputes")}</p>
                </CardContent>
              </Card>
            </div>

            {/* exports */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("admin.reports.exports")}</CardTitle>
                <CardDescription>{t("admin.reports.exportsDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    { id: "bookings" as const, icon: BarChart3, label: t("admin.reports.exportBookings") },
                    { id: "verification" as const, icon: HardHat, label: t("admin.reports.exportVerification") },
                    { id: "proofs" as const, icon: FileSearch, label: t("admin.reports.exportProofs") },
                  ]
                ).map((r) => (
                  <Button
                    key={r.id}
                    variant="outline"
                    className="justify-start"
                    disabled={downloading === r.id}
                    onClick={() => download(r.id)}
                  >
                    {downloading === r.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <r.icon className="mr-2 h-4 w-4" />
                        <Download className="mr-2 h-4 w-4" />
                      </>
                    )}
                    {r.label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{t("admin.reports.bookingsByStatus")}</CardTitle>
                  <CardDescription>
                    {t("admin.reports.totalBookings", { n: data.bookings.total })} ·{" "}
                    {etb(data.bookings.totalValue)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.bookings.byStatus.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("admin.reports.noData")}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {[...data.bookings.byStatus]
                        .sort((a, b) => b.n - a.n)
                        .map((s) => (
                          <li key={s.status} className="flex items-center gap-2 text-sm">
                            <StatusPill status={s.status} />
                            <span className="ml-auto font-medium">{s.n}</span>
                            <span className="w-24 text-right text-xs text-muted-foreground">
                              {etb(s.value)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{t("admin.reports.byCategory")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.bookings.byCategory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("admin.reports.noData")}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.bookings.byCategory.map((c) => (
                        <li key={c.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{c.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {c.n} · {etb(c.value)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${Math.max(
                                  3,
                                  (c.n / Math.max(1, data.bookings.byCategory[0].n)) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4" /> {t("admin.reports.dailyVolume")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.bookings.daily.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("admin.reports.noData")}</p>
                ) : (
                  <div className="flex h-40 items-end gap-0.5 overflow-x-auto">
                    {data.bookings.daily.map((d) => (
                      <div
                        key={d._id}
                        className="flex min-w-[6px] flex-1 flex-col justify-end gap-0.5"
                        title={`${d._id}: ${d.n} (${d.completed} completed)`}
                      >
                        <div
                          className="w-full rounded-t bg-muted"
                          style={{ height: `${(d.completed / maxDaily) * 100}%` }}
                        />
                        <div
                          className="w-full rounded-t bg-primary"
                          style={{ height: `${((d.n - d.completed) / maxDaily) * 100}%` }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("admin.reports.dailyLegend")}
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{t("admin.reports.topWorkers")}</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topWorkers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("admin.reports.noData")}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.topWorkers.map((w, i) => (
                        <li key={w.workerId} className="flex items-center gap-2 text-sm">
                          <span className="w-5 text-muted-foreground">{i + 1}</span>
                          <span className="font-medium">{w.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {t("admin.reports.jobsCount", { n: w.jobs })} · {etb(w.value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{t("admin.reports.pipeline")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(
                    [
                      { title: t("admin.reports.requests"), counts: data.pipeline.requests },
                      { title: t("admin.reports.quotations"), counts: data.pipeline.quotations },
                      { title: t("admin.reports.proofsStatus"), counts: proofs?.byStatus || {} },
                      { title: t("admin.reports.workersStatus"), counts: data.verification.byStatus },
                      { title: t("admin.reports.disputesStatus"), counts: data.pipeline.disputes },
                    ]
                  ).map((row) => (
                    <div key={row.title}>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {row.title}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {Object.entries(row.counts).length === 0 ? (
                          <span className="text-xs text-muted-foreground">{t("admin.reports.noData")}</span>
                        ) : (
                          Object.entries(row.counts).map(([k, v]) => (
                            <span
                              key={k}
                              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                            >
                              {label(k)} <span className="font-semibold">{v}</span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { WORKER_NAV } from "@/components/dashboard/nav-config";
import {
  AvailabilityMonth,
  type AvailabilityDay,
} from "@/components/dashboard/availability-calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, fmtDate, statusClass } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { ErrorState, StatCard } from "../_shared";

type CalendarDay = AvailabilityDay & {
  bookings: { _id: string; code?: string; title?: string; status?: string }[];
};

type Resp = {
  calendar: CalendarDay[];
  schedule: { day: string; open: string; close: string; closed: boolean }[];
  timeOff: { _id: string; from: string; to: string; reason?: string }[];
  availability: string;
  upcoming: {
    _id: string;
    code: string;
    title: string;
    status: string;
    startDate?: string | null;
    scheduledTime?: string;
  }[];
};

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function monthStart(offset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-01`;
}

export default function WorkerCalendarPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [offFrom, setOffFrom] = useState("");
  const [offTo, setOffTo] = useState("");
  const [offReason, setOffReason] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api<Resp>(`/api/worker/schedule?from=${monthStart(offset)}&days=42`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("common.error")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSlot = async (day: string, patch: Partial<Resp["schedule"][number]>) => {
    if (!data) return;
    setBusy(true);
    try {
      const next = DAY_ORDER.map((d) => {
        const existing = data.schedule.find((s) => s.day === d) || {
          day: d,
          open: "08:00",
          close: "17:00",
          closed: d === "sun",
        };
        return d === day ? { ...existing, ...patch } : existing;
      });
      await api("/api/worker/schedule", { method: "PATCH", body: { schedule: next } });
      load();
    } catch (e) {
      toast({
        title: t("common.error"),
        description: e instanceof Error ? e.message : t("common.retry"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const addTimeOff = async () => {
    setBusy(true);
    try {
      await api("/api/worker/schedule", {
        method: "PATCH",
        body: { timeOff: [{ from: offFrom, to: offTo || offFrom, reason: offReason }] },
      });
      setOffFrom("");
      setOffTo("");
      setOffReason("");
      toast({ title: t("common.scheduleTimeOffAdded") });
      load();
    } catch (e) {
      toast({
        title: t("common.error"),
        description: e instanceof Error ? e.message : t("common.retry"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const removeTimeOff = async (id: string) => {
    setBusy(true);
    try {
      await api("/api/worker/schedule", { method: "PATCH", body: { removeTimeOffId: id } });
      load();
    } catch (e) {
      toast({
        title: t("common.error"),
        description: e instanceof Error ? e.message : t("common.retry"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const bookedCount = (data?.calendar || []).filter((d) => d.bookings.length > 0).length;
  const openCount = (data?.calendar || []).filter((d) => d.available).length;

  return (
    <DashboardShell
      role="worker"
      nav={WORKER_NAV}
      title={t("common.scheduleTitle")}
      subtitle={t("common.scheduleSubtitle")}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={CalendarDays}
            label={t("common.scheduleOpenDays")}
            value={openCount}
            hint={t("common.scheduleNext42")}
          />
          <StatCard
            icon={Clock}
            label={t("common.scheduleBookedDays")}
            value={bookedCount}
            hint={t("common.scheduleNext42")}
          />
          <StatCard
            icon={CalendarDays}
            label={t("common.scheduleTimeOff")}
            value={data?.timeOff.length || 0}
          />
        </div>

        {error && <ErrorState message={error} onRetry={load} />}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold">{t("common.scheduleCalendar")}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" onClick={() => setOffset((o) => o - 1)} aria-label={t("common.prev")}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setOffset(0)}>
                    {t("common.today")}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setOffset((o) => o + 1)} aria-label={t("common.next")}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading && !data ? (
                <div className="h-72 animate-pulse rounded-lg bg-muted/30" />
              ) : (
                <AvailabilityMonth days={data?.calendar || []} interactive={false} />
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("common.scheduleWeeklyHours")}</CardTitle>
                <CardDescription>{t("common.scheduleWeeklyHoursDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {DAY_ORDER.map((d) => {
                  const slot = data?.schedule.find((s) => s.day === d);
                  const closed = slot ? slot.closed : d === "sun";
                  return (
                    <div key={d} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                      <span className="w-10 shrink-0 text-sm font-medium">{t(`admin.day.${d}`)}</span>
                      <Input
                        type="time"
                        defaultValue={slot?.open || "08:00"}
                        disabled={closed || busy}
                        onBlur={(e) => e.target.value && saveSlot(d, { open: e.target.value })}
                        className="w-28"
                        aria-label={`${d} open`}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        defaultValue={slot?.close || "17:00"}
                        disabled={closed || busy}
                        onBlur={(e) => e.target.value && saveSlot(d, { close: e.target.value })}
                        className="w-28"
                        aria-label={`${d} close`}
                      />
                      <Button
                        variant={closed ? "secondary" : "outline"}
                        size="sm"
                        disabled={busy}
                        className="ml-auto"
                        onClick={() => saveSlot(d, { closed: !closed })}
                      >
                        {closed ? t("common.scheduleClosed") : t("common.scheduleOpen")}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("common.scheduleTimeOff")}</CardTitle>
                <CardDescription>{t("common.scheduleTimeOffDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="off-from">{t("common.scheduleFrom")}</Label>
                      <Input id="off-from" type="date" value={offFrom} onChange={(e) => setOffFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="off-to">{t("common.scheduleTo")}</Label>
                      <Input id="off-to" type="date" value={offTo} onChange={(e) => setOffTo(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="off-reason">{t("common.scheduleReason")}</Label>
                    <Input
                      id="off-reason"
                      value={offReason}
                      onChange={(e) => setOffReason(e.target.value)}
                      placeholder={t("common.scheduleReasonPlaceholder")}
                    />
                  </div>
                  <Button size="sm" disabled={busy || !offFrom} onClick={addTimeOff}>
                    {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
                    {t("common.scheduleAddTimeOff")}
                  </Button>
                </div>

                {data && data.timeOff.length > 0 && (
                  <ul className="space-y-2">
                    {data.timeOff.map((t2) => (
                      <li key={t2._id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {fmtDate(t2.from)}
                            {t2.to && t2.to.slice(0, 10) !== t2.from.slice(0, 10) ? ` – ${fmtDate(t2.to)}` : ""}
                          </p>
                          {t2.reason && <p className="truncate text-xs text-muted-foreground">{t2.reason}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          aria-label={t("common.delete")}
                          onClick={() => removeTimeOff(t2._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t("common.scheduleUpcomingJobs")}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !data ? (
              <div className="h-24 animate-pulse rounded-lg bg-muted/30" />
            ) : !data || data.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.scheduleNoUpcoming")}</p>
            ) : (
              <ul className="space-y-2">
                {data.upcoming.map((b) => (
                  <li key={b._id} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
                    <span className="font-mono text-xs text-muted-foreground">{b.code}</span>
                    <span className="font-medium">{b.title}</span>
                    <Badge className={statusClass(b.status)}>{b.status}</Badge>
                    <span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmtDate(b.startDate)}
                      {b.scheduledTime ? ` · ${b.scheduledTime}` : ""}
                    </span>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/dashboard/worker/jobs/${b._id}`}>{t("common.view")}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

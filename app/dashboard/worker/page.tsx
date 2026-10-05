"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarClock,
  ClipboardList,
  MessageSquare,
  Star,
  TriangleAlert,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { WORKER_NAV } from "@/components/dashboard/nav-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, etb, statusClass, timeAgo, URGENCY_CLASS } from "@/lib/client";
import { useAuth } from "@/context/auth";
import { useLocale } from "@/context/locale";
import { useToast } from "@/hooks/use-toast";
import {
  avgRating,
  EmptyState,
  ErrorState,
  PageSkeleton,
  StatCard,
  VerificationBanner,
  useErrMsg,
  type BookingListItemT,
  type RequestItemT,
  type WorkerProfileT,
} from "./_shared";

const ACTIVE_STATUSES = ["WORK_STARTED", "IN_PROGRESS", "AWAITING_CUSTOMER", "READY_FOR_REVIEW", "WORKER_ON_THE_WAY"];
const UPCOMING_STATUSES = [
  "BOOKING_CONFIRMED",
  "ADVANCE_PAYMENT_DUE",
  "PAYMENT_PROOF_SUBMITTED",
  "PAYMENT_VERIFIED",
  "SCHEDULED",
];
const DONE_STATUSES = ["COMPLETED", "CUSTOMER_CONFIRMED", "CLOSED"];

const AVAILABILITY_LABEL: Record<string, string> = {
  available: "worker.availability.available",
  busy: "worker.availability.busy",
  away: "worker.availability.away",
  offline: "worker.availability.offline",
};

export default function WorkerOverviewPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLocale();
  const errMsg = useErrMsg();
  const [profile, setProfile] = useState<WorkerProfileT | null>(null);
  const [bookings, setBookings] = useState<BookingListItemT[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [requests, setRequests] = useState<RequestItemT[]>([]);
  const [newRequests, setNewRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, b, r] = await Promise.all([
        api<{ profile: WorkerProfileT | null }>("/api/worker/profile"),
        api<{ items: BookingListItemT[]; statusCounts: Record<string, number> }>("/api/bookings?limit=10"),
        api<{ items: RequestItemT[]; total: number }>("/api/requests?view=available&limit=3"),
      ]);
      setProfile(p.profile);
      setBookings(b.items || []);
      setStatusCounts(b.statusCounts || {});
      setRequests(r.items || []);
      setNewRequests(r.total || 0);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [errMsg]);

  useEffect(() => {
    load();
  }, [load]);

  const patchProfile = async (body: Record<string, unknown>, okMessage: string) => {
    setSaving(true);
    try {
      const d = await api<{ profile: WorkerProfileT }>("/api/worker/profile", { method: "PATCH", body });
      setProfile(d.profile);
      toast({ title: okMessage });
    } catch (err) {
      toast({ title: t("worker.error.couldNotSave"), description: errMsg(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const count = (keys: string[]) => keys.reduce((sum, k) => sum + (statusCounts[k] || 0), 0);

  const upcoming = bookings.filter((b) => UPCOMING_STATUSES.includes(b.status)).slice(0, 3);
  const recentBookings = bookings.slice(0, 3);

  return (
    <DashboardShell
      role="worker"
      nav={WORKER_NAV}
      title={t("nav.overview")}
      subtitle={`${t("worker.overview.welcomeBack")}${user ? `, ${user.name.split(" ")[0]}` : ""}`}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {loading && <PageSkeleton rows={2} />}

        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && profile && (
          <>
            <VerificationBanner profile={profile} onResubmitted={setProfile} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatCard
                label={t("worker.overview.newRequests")}
                value={newRequests}
                icon={ClipboardList}
                hint={t("worker.overview.matchedHint")}
                href="/dashboard/worker/requests"
              />
              <StatCard label={t("worker.overview.activeJobs")} value={count(ACTIVE_STATUSES)} icon={Briefcase} href="/dashboard/worker/jobs" />
              <StatCard label={t("worker.overview.upcomingJobs")} value={count(UPCOMING_STATUSES)} icon={CalendarClock} href="/dashboard/worker/jobs" />
              <StatCard label={t("worker.overview.completedJobs")} value={count(DONE_STATUSES)} icon={BadgeCheck} href="/dashboard/worker/jobs" />
              <StatCard
                label={t("worker.overview.avgRating")}
                value={
                  <span className="inline-flex items-center gap-1">
                    {avgRating(profile.stats)}
                    <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                  </span>
                }
                icon={Star}
                hint={t("worker.overview.reviewsCount", { count: profile.stats?.ratingCount || 0 })}
                href="/dashboard/worker/reviews"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("worker.overview.availability")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("common.status")}</Label>
                    <Select
                      value={profile.availability || "available"}
                      disabled={saving}
                      onValueChange={(v) => patchProfile({ availability: v }, t("worker.overview.availabilityUpdated"))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["available", "busy", "away", "offline"].map((v) => (
                          <SelectItem key={v} value={v}>
                            {t(AVAILABILITY_LABEL[v])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {profile.availability === "available"
                        ? t("worker.overview.visibleHint")
                        : t("worker.overview.notMatchedHint")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="pr-3">
                      <Label htmlFor="emergency-toggle" className="cursor-pointer">
                        {t("worker.overview.emergencyJobs")}
                      </Label>
                      <p className="text-xs text-muted-foreground">{t("worker.overview.emergencyHint")}</p>
                    </div>
                    <Switch
                      id="emergency-toggle"
                      checked={!!profile.emergencyAvailable}
                      disabled={saving}
                      onCheckedChange={(v) =>
                        patchProfile({ emergencyAvailable: v }, t("worker.overview.emergencySaved"))
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("worker.overview.quickLinks")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    {
                      href: "/dashboard/worker/requests",
                      label: t("nav.jobRequests"),
                      icon: ClipboardList,
                      hint: t("worker.overview.waitingQuote", { count: newRequests }),
                    },
                    {
                      href: "/dashboard/worker/jobs",
                      label: t("nav.myJobs"),
                      icon: Briefcase,
                      hint: t("worker.overview.activeNow", { count: count(ACTIVE_STATUSES) }),
                    },
                    {
                      href: "/dashboard/worker/messages",
                      label: t("nav.messages"),
                      icon: MessageSquare,
                      hint: t("worker.overview.chatHint"),
                    },
                  ].map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/50"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <l.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{l.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{l.hint}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("worker.overview.recentActivity")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentBookings.length === 0 && upcoming.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      {t("worker.overview.noBookingsYet")}
                    </p>
                  )}
                  {recentBookings.map((b) => (
                    <Link
                      key={b._id}
                      href={`/dashboard/worker/jobs/${b._id}`}
                      className="block rounded-lg border p-3 transition hover:border-primary/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{b.title}</span>
                        <Badge className={`shrink-0 ${statusClass(b.status)}`} variant="secondary">
                          {t(`worker.status.${b.status.toLowerCase()}`)}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {b.code} · {timeAgo(b.createdAt)}
                        </span>
                        <span className="font-medium text-foreground">
                          {etb(b.paymentSummary?.verified || 0)} / {etb(b.paymentSummary?.total || b.agreedTotal)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{t("worker.overview.latestRequests")}</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/worker/requests">
                    {t("common.viewAll")} <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {requests.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title={t("worker.overview.noNewRequests")}
                    hint={t("worker.overview.noNewRequestsHint")}
                    action={
                      <Button asChild variant="outline" size="sm">
                        <Link href="/dashboard/worker/profile">{t("worker.overview.updateServiceArea")}</Link>
                      </Button>
                    }
                  />
                ) : (
                  requests.map((r) => (
                    <div key={r._id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={URGENCY_CLASS[r.urgency] || URGENCY_CLASS.normal} variant="secondary">
                            {r.urgency === "emergency" && <TriangleAlert className="mr-1 h-3 w-3" />}
                            {t(`common.urgency.${r.urgency}`)}
                          </Badge>
                          <span className="truncate text-sm font-medium">{r.title}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {r.customerId?.name} · {r.location?.city}
                          {r.location?.woreda ? ` · ${r.location.woreda}` : ""} ·{" "}
                          {r.budget > 0 ? etb(r.budget) : t("worker.budgetNotSet")} · {timeAgo(r.createdAt)}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="shrink-0">
                        <Link href={`/dashboard/worker/requests/${r._id}`}>{t("worker.overview.viewQuote")}</Link>
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

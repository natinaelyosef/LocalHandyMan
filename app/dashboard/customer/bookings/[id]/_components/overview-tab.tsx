"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, etb, fmtDate } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import type { BookingDetail } from "@/app/dashboard/customer/_lib/types";
import { rid, ravatar, rname } from "@/app/dashboard/customer/_lib/types";
import { FieldError, StatusBadge, errText, useStatusLabel } from "@/app/dashboard/customer/_lib/ui";

type CustomerAction = {
  status: string;
  labelKey: string;
  needsReason: boolean;
  descKey: string;
  destructive?: boolean;
  confirmKey: string;
};

const ACTIONS: CustomerAction[] = [
  {
    status: "CUSTOMER_CONFIRMED",
    labelKey: "customer.action.confirmCompletion",
    confirmKey: "customer.action.confirmCompletion",
    needsReason: false,
    descKey: "customer.action.confirmCompletionDesc",
  },
  {
    status: "CLOSED",
    labelKey: "customer.action.closeBooking",
    confirmKey: "customer.action.closeBooking",
    needsReason: false,
    descKey: "customer.action.closeBookingDesc",
  },
  {
    status: "DISPUTED",
    labelKey: "customer.action.reportProblem",
    confirmKey: "customer.action.openDispute",
    needsReason: true,
    destructive: true,
    descKey: "customer.action.reportProblemDesc",
  },
  {
    status: "CANCELLED",
    labelKey: "customer.action.cancelBooking",
    confirmKey: "customer.action.cancelBooking",
    needsReason: true,
    destructive: true,
    descKey: "customer.action.cancelBookingDesc",
  },
];

export function OverviewTab({ data, reload }: { data: BookingDetail; reload: () => void }) {
  const { booking, request } = data;
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLocale();
  const statusLabel = useStatusLabel();
  const [target, setTarget] = useState<CustomerAction | null>(null);
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState("");
  const [busy, setBusy] = useState(false);

  const allowed = booking.allowedTransitions || {};
  const actions = ACTIONS.filter(
    (a) => a.status in allowed || (a.status === "CUSTOMER_CONFIRMED" && booking.status === "COMPLETED")
  );
  const conversationId = data.conversation?._id || rid(booking.conversationId || null);
  const ps = booking.paymentSummary || { total: 0, verified: 0, pending: 0, remaining: 0 };
  const loc = booking.location || {};

  const confirm = async () => {
    if (!target) return;
    if (target.needsReason && reason.trim().length < 3) {
      setReasonErr(t("customer.action.reasonError"));
      return;
    }
    setBusy(true);
    setReasonErr("");
    try {
      await api(`/api/bookings/${rid(booking)}/status`, {
        method: "POST",
        body: { status: target.status, reason: reason.trim() },
      });
      toast({ title: t(target.labelKey), description: t("customer.action.statusUpdated") });
      setTarget(null);
      setReason("");
      reload();
    } catch (e) {
      setReasonErr(errText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 sm:p-5 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("customer.overviewTab.yourWorker")}
          </p>
          <div className="mt-3 flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={ravatar(booking.workerId)} alt={rname(booking.workerId)} />
              <AvatarFallback>{(rname(booking.workerId) || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <Link href={`/workers/${rid(booking.workerId)}`} className="text-lg font-semibold hover:underline">
                {rname(booking.workerId, t("customer.workerLabel"))}
              </Link>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <StatusBadge status={booking.status} />
                {booking.workerId && typeof booking.workerId === "object" && booking.workerId.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {booking.workerId.phone}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/workers/${rid(booking.workerId)}`}>{t("nav.profile")}</Link>
              </Button>
              {conversationId && (
                <Button size="sm" onClick={() => router.push(`/dashboard/customer/messages/${conversationId}`)}>
                  <MessageSquare className="mr-2 h-4 w-4" /> {t("customer.messageLabel")}
                </Button>
              )}
            </div>
          </div>

          {request?.description && (
            <div className="mt-4 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("customer.overviewTab.jobDescription")}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{request.description}</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("customer.overviewTab.locationDates")}
          </p>
          <ul className="mt-3 space-y-2.5 text-sm">
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                {[loc.label, loc.area, loc.subCity, loc.city, loc.region].filter(Boolean).join(", ") || "—"}
              </span>
            </li>
            <li className="flex gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                {t("customer.overviewTab.start", { date: booking.startDate ? fmtDate(booking.startDate) : "—" })}
                <br />
                {t("customer.overviewTab.expected", {
                  date: booking.expectedCompletion ? fmtDate(booking.expectedCompletion) : "—",
                })}
              </span>
            </li>
            <li className="flex gap-2">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{t("customer.overviewTab.created", { date: fmtDate(booking.createdAt) })}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={t("customer.bookings.agreedTotal")} value={etb(booking.agreedTotal)} />
        <SummaryCard label={t("customer.overviewTab.verifiedPaid")} value={etb(ps.verified)} tone="emerald" />
        <SummaryCard label={t("customer.overviewTab.pendingVerification")} value={etb(ps.pending)} tone="amber" />
        <SummaryCard label={t("customer.payments.remaining")} value={etb(ps.remaining)} />
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t("customer.overviewTab.jobStatus")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("customer.overviewTab.currentStatus", {
                status: statusLabel(booking.status),
                pct: booking.progressPercent || 0,
              })}
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Progress value={booking.progressPercent || 0} className="h-2" />
          </div>
        </div>

        {actions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            {actions.map((a) => (
              <Button
                key={a.status}
                size="sm"
                variant={a.destructive ? "destructive" : a.status === "CUSTOMER_CONFIRMED" ? "default" : "outline"}
                onClick={() => {
                  setTarget(a);
                  setReason("");
                  setReasonErr("");
                }}
              >
                {a.status === "CUSTOMER_CONFIRMED" && <CheckCircle2 className="mr-2 h-4 w-4" />}
                {a.status === "DISPUTED" && <AlertTriangle className="mr-2 h-4 w-4" />}
                {a.status === "CANCELLED" && <Ban className="mr-2 h-4 w-4" />}
                {t(a.labelKey)}
              </Button>
            ))}
          </div>
        )}
        {actions.length === 0 && (
          <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
            {t("customer.overviewTab.noActions")}
          </p>
        )}
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{target ? t(target.labelKey) : ""}</DialogTitle>
            <DialogDescription>{target ? t(target.descKey) : ""}</DialogDescription>
          </DialogHeader>
          {target?.needsReason && (
            <div className="space-y-2">
              <Label htmlFor="status-reason">{t("customer.action.reasonLabel")} *</Label>
              <Textarea
                id="status-reason"
                rows={3}
                placeholder={t("customer.action.reasonPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <FieldError msg={reasonErr} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>
              {t("customer.action.goBack")}
            </Button>
            <Button variant={target?.destructive ? "destructive" : "default"} onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {target ? t(target.confirmKey) : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const toneCls =
    tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : tone === "amber" ? "text-amber-600 dark:text-amber-400" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${toneCls}`}>{value}</p>
    </div>
  );
}

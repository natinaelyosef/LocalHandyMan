"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, etb, fileUrl, fmtDate, timeAgo } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import type { Quotation, ServiceRequest } from "@/app/dashboard/customer/_lib/types";
import { rid, rname, ravatar } from "@/app/dashboard/customer/_lib/types";
import {
  EmptyState,
  ErrorState,
  FieldError,
  StatusBadge,
  UrgencyBadge,
  errText,
  usePageId,
} from "@/app/dashboard/customer/_lib/ui";

type Action = { type: "accept" | "reject" | "changes"; quote: Quotation };

export default function RequestDetailPage() {
  const id = usePageId();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLocale();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [noteErr, setNoteErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const d = await api<{ request: ServiceRequest; quotations: Quotation[] }>(`/api/requests/${id}`);
      // Offers created by the one-click Accept action surface first (UI-SPEC 5.2).
      const sorted = [...(d.quotations || [])].sort((a, b) => {
        const rank = (q: Quotation) => (q.source === "accept" && q.status === "pending" ? 1 : 0);
        return rank(b) - rank(a);
      });
      setRequest(d.request);
      setQuotes(sorted);
    } catch (e) {
      setError(errText(e, t));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async () => {
    if (!action) return;
    if (action.type !== "accept" && note.trim().length < 3) {
      setNoteErr(t("customer.reqDetail.noteError"));
      return;
    }
    setBusy(true);
    setNoteErr("");
    try {
      const res = await api<{ booking?: { _id: string } }>(`/api/quotations/${action.quote._id}`, {
        method: "PATCH",
        body: {
          action: action.type === "accept" ? "accept" : action.type === "reject" ? "reject" : "request_changes",
          note: note.trim(),
        },
      });
      if (action.type === "accept") {
        const bookingId = res.booking?._id || rid(action.quote.bookingId) || rid(request?.bookingId);
        toast({ title: t("customer.reqDetail.bookingConfirmed"), description: t("customer.reqDetail.bookingConfirmedDesc") });
        router.push(`/dashboard/customer/bookings/${bookingId}`);
        return;
      }
      toast({
        title:
          action.type === "reject" ? t("customer.reqDetail.quoteDeclined") : t("customer.reqDetail.changesRequested"),
        description: t("customer.reqDetail.workerNotified"),
      });
      setAction(null);
      setNote("");
      await load();
    } catch (e) {
      setNoteErr(errText(e, t));
    } finally {
      setBusy(false);
    }
  };

  const accepted = quotes.find((q) => q.status === "accepted");
  const bookingId = rid(accepted?.bookingId) || rid(request?.bookingId);

  return (
    <DashboardShell
      role="customer"
      nav={CUSTOMER_NAV}
      title={t("customer.reqDetail.title")}
      subtitle={
        request
          ? `${request.reference} · ${rname(request.categoryId, t("customer.serviceFallback"))}`
          : t("common.loading")
      }
    >
      <div className="mx-auto max-w-6xl space-y-6">
        {loading && (
          <div className="space-y-4">
            <div className="h-40 rounded-xl border bg-card" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="h-72 rounded-xl border bg-card" />
              <div className="h-72 rounded-xl border bg-card" />
            </div>
          </div>
        )}

        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && request && (
          <>
            {bookingId && (
              <div className="flex flex-col gap-3 rounded-xl border border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    {t("customer.reqDetail.bookingBannerTitle")}
                  </p>
                  <p className="text-sm text-emerald-800 dark:text-emerald-300">
                    {t("customer.reqDetail.bookingBannerDesc")}
                  </p>
                </div>
                <Button asChild>
                  <Link href={`/dashboard/customer/bookings/${bookingId}`}>
                    {t("customer.openBooking")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}

            <section className="rounded-xl border bg-card p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {request.reference}
                </Badge>
                <StatusBadge status={request.status} />
                <UrgencyBadge urgency={request.urgency} />
                <span className="ml-auto text-xs text-muted-foreground">
                  {t("customer.reqDetail.postedAgo", { when: timeAgo(request.createdAt) })}
                </span>
              </div>

              <h2 className="mt-3 text-xl font-bold sm:text-2xl">{request.title}</h2>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {rname(request.categoryId, t("customer.serviceFallback"))}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {request.description}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoBox icon={MapPin} label={t("common.location")} value={[request.location?.area, request.location?.city, request.location?.region].filter(Boolean).join(", ") || "—"} />
                <InfoBox
                  icon={CalendarDays}
                  label={t("customer.reqDetail.preferredDate")}
                  value={
                    request.preferredDate
                      ? `${fmtDate(request.preferredDate)}${request.preferredTime ? ` · ${request.preferredTime}` : ""}`
                      : t("customer.flexible")
                  }
                />
                <InfoBox
                  icon={Wallet}
                  label={t("customer.budgetLabel")}
                  value={request.budget ? etb(request.budget) : t("common.notSet")}
                />
                <InfoBox icon={Clock} label={t("customer.reqDetail.expires")} value={request.expiresAt ? fmtDate(request.expiresAt) : "—"} />
              </div>

              {(request.mediaFileIds || []).length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("customer.photosLabel")}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {(request.mediaFileIds || []).map((f) => (
                      <a
                        key={f}
                        href={fileUrl(f)}
                        target="_blank"
                        rel="noreferrer"
                        className="block h-24 w-24 overflow-hidden rounded-lg border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fileUrl(f)} alt={t("customer.reqDetail.photoAlt")} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {(request.measurements || request.requiredMaterials || request.accessInstructions || request.specialInstructions) && (
                <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2">
                  {request.measurements && <Detail label={t("customer.newReq.measurements")} value={request.measurements} />}
                  {request.requiredMaterials && <Detail label={t("customer.newReq.materials")} value={request.requiredMaterials} />}
                  {request.accessInstructions && <Detail label={t("customer.newReq.accessInstructions")} value={request.accessInstructions} />}
                  {request.specialInstructions && <Detail label={t("customer.newReq.specialInstructions")} value={request.specialInstructions} />}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{t("customer.reqDetail.quotations")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {quotes.length
                      ? t("customer.reqDetail.quotesCount", { n: quotes.length })
                      : t("customer.reqDetail.quotesCompareHint")}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/customer/requests/new">
                    <FileText className="mr-2 h-4 w-4" /> {t("nav.newRequest")}
                  </Link>
                </Button>
              </div>

              {quotes.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title={t("customer.reqDetail.waitingTitle")}
                  message={t("customer.reqDetail.waitingMsg")}
                >
                  <Button asChild variant="outline">
                    <Link href="/dashboard/customer/requests">{t("customer.reqDetail.backToRequests")}</Link>
                  </Button>
                </EmptyState>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {quotes.map((q) => {
                    const pending = q.status === "pending";
                    return (
                      <div key={q._id} className="flex flex-col rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={ravatar(q.workerId)} alt={rname(q.workerId)} />
                            <AvatarFallback>{(rname(q.workerId) || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/workers/${rid(q.workerId)}`}
                              className="truncate font-semibold hover:underline"
                            >
                              {rname(q.workerId, t("customer.workerLabel"))}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {q.responseMinutes
                                ? t("customer.reqDetail.repliedIn", { n: q.responseMinutes })
                                : t("customer.reqDetail.quotedWhen", { when: timeAgo(q.createdAt) })}
                            </p>
                          </div>
                          {q.source === "accept" && (
                            <Badge className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300" variant="secondary">
                              {t("customer.reqDetail.acceptedJob")}
                            </Badge>
                          )}
                          <StatusBadge status={q.status} />
                        </div>

                        <p className="mt-4 text-3xl font-bold">{etb(q.total)}</p>
                        <p className="text-xs text-muted-foreground">{t("customer.reqDetail.totalQuoted")}</p>

                        {pending && q.source === "accept" && (
                          <div className="mt-3 rounded-lg border border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 p-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                            {t("customer.reqDetail.acceptBanner", {
                              name: rname(q.workerId, t("customer.thisWorker")),
                              amount: etb(q.total),
                            })}
                          </div>
                        )}

                        <Separator className="my-3" />

                        <dl className="space-y-1.5 text-sm">
                          <Row label={t("customer.reqDetail.labour")} value={etb(q.laborCost)} />
                          <Row label={t("customer.reqDetail.materialsCost")} value={etb(q.materialsCost)} />
                          <Row label={t("customer.reqDetail.transport")} value={etb(q.transportCost)} />
                          <Row label={t("customer.reqDetail.other")} value={etb(q.otherCost)} />
                          <Row label={t("customer.reqDetail.duration")} value={q.estimatedDuration || "—"} />
                          <Row
                            label={t("customer.reqDetail.proposedDates")}
                            value={
                              q.proposedStartDate
                                ? `${fmtDate(q.proposedStartDate)} → ${q.proposedEndDate ? fmtDate(q.proposedEndDate) : t("customer.tbd")}`
                                : t("customer.flexible")
                            }
                          />
                          <Row
                            label={t("customer.reqDetail.warranty")}
                            value={q.warrantyDays ? t("customer.reqDetail.warrantyDays", { n: q.warrantyDays }) : t("common.none")}
                          />
                        </dl>

                        {(q.paymentPlan || []).length > 0 && (
                          <div className="mt-3 rounded-lg bg-muted/60 p-2.5">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("customer.reqDetail.paymentPlan")}
                            </p>
                            <ul className="space-y-0.5 text-xs">
                              {(q.paymentPlan || []).map((p, i) => (
                                <li key={i} className="flex justify-between">
                                  <span>{p.label}</span>
                                  <span className="font-medium">{p.percent}%</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {q.notes && (
                          <p className="mt-3 rounded-lg bg-muted/60 p-2.5 text-xs leading-relaxed text-muted-foreground">
                            {q.notes}
                          </p>
                        )}

                        {q.customerNote && q.status !== "pending" && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {t("customer.reqDetail.yourNote")}: <span className="italic">“{q.customerNote}”</span>
                          </p>
                        )}

                        <div className="mt-4 flex gap-2 border-t pt-3">
                          {pending && request.status !== "cancelled" ? (
                            <>
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  setAction({ type: "accept", quote: q });
                                  setNote("");
                                  setNoteErr("");
                                }}
                              >
                                {q.source === "accept" ? t("customer.reqDetail.confirmBook") : t("customer.reqDetail.accept")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAction({ type: "changes", quote: q });
                                  setNote("");
                                  setNoteErr("");
                                }}
                              >
                                {t("customer.reqDetail.changes")}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 dark:text-red-400 hover:text-red-700"
                                onClick={() => {
                                  setAction({ type: "reject", quote: q });
                                  setNote("");
                                  setNoteErr("");
                                }}
                              >
                                {t("customer.reqDetail.decline")}
                              </Button>
                            </>
                          ) : (
                            <Button asChild size="sm" variant="outline" className="w-full">
                              <Link href={`/workers/${rid(q.workerId)}`}>
                                {t("customer.viewWorkerProfile")} <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              {t("customer.reqDetail.paymentsNotice")}
            </div>
          </>
        )}
      </div>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action?.type === "accept"
                ? action?.quote.source === "accept"
                  ? t("customer.reqDetail.confirmJobTitle")
                  : t("customer.reqDetail.acceptQuoteTitle")
                : action?.type === "reject"
                  ? t("customer.reqDetail.declineQuoteTitle")
                  : t("customer.reqDetail.requestChangesTitle")}
            </DialogTitle>
            <DialogDescription>
              {action?.type === "accept"
                ? action?.quote.source === "accept"
                  ? t("customer.reqDetail.confirmJobDesc", {
                      amount: etb(action?.quote.total || 0),
                      name: rname(action?.quote.workerId, t("customer.thisWorkerLower")),
                    })
                  : t("customer.reqDetail.acceptQuoteDesc", {
                      amount: etb(action?.quote.total || 0),
                      name: rname(action?.quote.workerId, t("customer.thisWorkerLower")),
                    })
                : action?.type === "reject"
                  ? t("customer.reqDetail.declineQuoteDesc")
                  : t("customer.reqDetail.requestChangesDesc")}
            </DialogDescription>
          </DialogHeader>
          {action?.type !== "accept" && (
            <div className="space-y-2">
              <Label htmlFor="quote-note">{t("customer.reqDetail.noteToWorker")}</Label>
              <Textarea
                id="quote-note"
                rows={3}
                placeholder={t("customer.reqDetail.notePlaceholder")}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <FieldError msg={noteErr} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button
              variant={action?.type === "reject" ? "destructive" : "default"}
              onClick={runAction}
              disabled={busy}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action?.type === "accept"
                ? action?.quote.source === "accept"
                  ? t("customer.reqDetail.confirmCreateBooking")
                  : t("customer.reqDetail.acceptCreateBooking")
                : action?.type === "reject"
                  ? t("customer.reqDetail.decline")
                  : t("customer.reqDetail.sendRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function InfoBox({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

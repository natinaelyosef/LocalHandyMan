"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CircleCheckBig,
  ClipboardList,
  Handshake,
  Images,
  Info,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { WORKER_NAV } from "@/components/dashboard/nav-config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, etb, fileUrl, fmtDate, fmtDateTime, statusClass, timeAgo, URGENCY_CLASS } from "@/lib/client";
import { useLocale } from "@/context/locale";
import { useToast } from "@/hooks/use-toast";
import { ErrorState, markQuoted, useErrMsg, type QuotationT, type RequestItemT, type WorkerProfileT } from "../../_shared";

type PlanRow = { label: string; percent: number };

const DEFAULT_PLAN: PlanRow[] = [
  { label: "Advance", percent: 30 },
  { label: "Progress", percent: 40 },
  { label: "Final", percent: 30 },
];

function n(v: string): number {
  const x = Number(v);
  return isNaN(x) || x < 0 ? 0 : x;
}

export default function WorkerRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLocale();
  const errMsg = useErrMsg();

  const [request, setRequest] = useState<RequestItemT | null>(null);
  const [myQuotation, setMyQuotation] = useState<QuotationT | null>(null);
  const [profile, setProfile] = useState<WorkerProfileT | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [labor, setLabor] = useState("");
  const [materials, setMaterials] = useState("");
  const [transport, setTransport] = useState("");
  const [other, setOther] = useState("");
  const [duration, setDuration] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [warranty, setWarranty] = useState("0");
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<PlanRow[]>(DEFAULT_PLAN);

  const [acceptPrice, setAcceptPrice] = useState("");
  const [acceptNote, setAcceptNote] = useState("");
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [messaging, setMessaging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api<{
        request: RequestItemT;
        myQuotation: QuotationT | null;
        profile: WorkerProfileT | null;
      }>(`/api/requests/${id}`);
      setRequest(d.request);
      setMyQuotation(d.myQuotation || null);
      setProfile(d.profile || null);
      setAcceptPrice(d.request.budget > 0 ? String(d.request.budget) : "");
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [errMsg, id]);

  useEffect(() => {
    load();
  }, [load]);

  const total = n(labor) + n(materials) + n(transport) + n(other);
  const planSum = plan.reduce((s, p) => s + (Number.isFinite(p.percent) ? p.percent : 0), 0);
  const planValid = plan.length === 0 || (planSum === 100 && plan.every((p) => p.label.trim().length > 0 && p.percent > 0));

  const isOpen = !!request && (request.status === "open" || request.status === "quoted");
  const profileApproved = !!profile && profile.status === "approved";
  const isOffline = !!profile && profile.availability === "offline";
  const canAccept = isOpen && !myQuotation && profileApproved && !isOffline;
  const acceptedByMe = myQuotation?.source === "accept";
  const waitingOnCustomer = !!myQuotation && myQuotation.status === "pending";

  const acceptJob = async () => {
    setFormError("");
    const price = Number(acceptPrice);
    if (!(price > 0)) {
      setFormError(t("worker.accept.priceRequired"));
      return;
    }
    setAccepting(true);
    try {
      const d = await api<{ quotation: QuotationT }>(`/api/requests/${id}/accept`, {
        body: { price, note: acceptNote.trim() },
      });
      setMyQuotation(d.quotation);
      markQuoted(id, price);
      setAcceptOpen(false);
      setAcceptNote("");
      setFormError("");
      toast({
        title: t("worker.accept.sentTitle"),
        description: t("worker.accept.sentDesc"),
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message = errMsg(err);
      setFormError(message);
      toast({ title: t("worker.accept.failedTitle"), description: message, variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  const messageCustomer = async () => {
    const customerId = request?.customerId?._id;
    if (!customerId) return;
    setMessaging(true);
    try {
      const d = await api<{ conversation: { _id: string } }>("/api/conversations", {
        body: { customerId },
      });
      router.push(`/dashboard/worker/messages/${d.conversation._id}`);
    } catch (err) {
      toast({
        title: t("worker.reqDetail.chatFailedTitle"),
        description: errMsg(err),
        variant: "destructive",
      });
    } finally {
      setMessaging(false);
    }
  };

  const setRow = (i: number, patch: Partial<PlanRow>) =>
    setPlan((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const submit = async () => {
    setFormError("");
    if (n(labor) <= 0) {
      setFormError(t("worker.reqDetail.laborRequired"));
      return;
    }
    if (!planValid) {
      setFormError(
        planSum === 100
          ? t("worker.reqDetail.planRowInvalid")
          : t("worker.reqDetail.planPercentInvalid", { percent: planSum })
      );
      return;
    }
    setSubmitting(true);
    try {
      const d = await api<{ quotation: QuotationT }>(`/api/requests/${id}/quotations`, {
        body: {
          laborCost: n(labor),
          materialsCost: n(materials),
          transportCost: n(transport),
          otherCost: n(other),
          estimatedDuration: duration,
          proposedStartDate: startDate || undefined,
          proposedEndDate: endDate || undefined,
          warrantyDays: n(warranty),
          notes,
          paymentPlan: plan.filter((p) => p.label.trim() && p.percent > 0).map((p) => ({ label: p.label.trim(), percent: p.percent })),
        },
      });
      setMyQuotation(d.quotation);
      markQuoted(id, d.quotation.total);
      toast({
        title: t("worker.reqDetail.quoteSubmittedTitle"),
        description: t("worker.reqDetail.quoteSubmittedDesc", { amount: etb(d.quotation.total) }),
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const message = errMsg(err);
      setFormError(message);
      toast({ title: t("worker.reqDetail.quoteFailedTitle"), description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardShell
      role="worker"
      nav={WORKER_NAV}
      title={t("worker.reqDetail.title")}
      subtitle={t("worker.reqDetail.subtitle")}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/worker/requests">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> {t("worker.reqDetail.backToRequests")}
          </Link>
        </Button>

        {loading && (
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="space-y-4">
              <Skeleton className="h-52 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
            <Skeleton className="h-96 rounded-xl" />
          </div>
        )}

        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && request && (
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="space-y-6">
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={URGENCY_CLASS[request.urgency] || URGENCY_CLASS.normal} variant="secondary">
                      {request.urgency === "emergency" && <TriangleAlert className="mr-1 h-3 w-3" />}
                      {t(`common.urgency.${request.urgency}`)}
                    </Badge>
                    <Badge variant="outline">{request.categoryId?.icon ? `${request.categoryId.icon} ` : ""}{request.categoryId?.name}</Badge>
                    <Badge variant="secondary" className={statusClass(request.status)}>
                      {t(`worker.reqStatus.${request.status}`)}
                    </Badge>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t("worker.reqDetail.postedAt", { ref: request.reference, when: timeAgo(request.createdAt) })}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">{request.title}</h2>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {request.description}
                    </p>
                  </div>

                  {request.mediaFileIds && request.mediaFileIds.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                        <Images className="h-4 w-4" />{" "}
                        {t("worker.reqDetail.photos", { count: request.mediaFileIds.length })}
                      </p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {request.mediaFileIds.map((fid) => (
                          <a
                            key={fid}
                            href={fileUrl(fid)}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-lg border"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fileUrl(fid)} alt={t("worker.reqDetail.jobPhotoAlt")} loading="lazy" decoding="async" className="h-32 w-full object-cover transition hover:scale-105" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-4 w-4 text-primary" /> {t("common.location")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <p className="font-medium">{request.location?.label || t("worker.reqDetail.jobSite")}</p>
                    <p className="text-muted-foreground">
                      {[request.location?.area, request.location?.woreda, request.location?.city, request.location?.region]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </p>
                    {request.location?.street && (
                      <p className="text-muted-foreground">
                        {t("worker.reqDetail.street", { street: request.location.street })}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-1.5 text-sm">
                      <Info className="h-4 w-4 text-primary" /> {t("worker.reqDetail.jobDetails")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{t("worker.reqDetail.preferredDate")}</span>
                      <span className="text-right font-medium">
                        {request.preferredDate ? fmtDate(request.preferredDate) : "—"}
                        {request.preferredTime ? ` · ${request.preferredTime}` : ""}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{t("worker.reqDetail.customerBudget")}</span>
                      <span className="font-medium">
                        {request.budget > 0 ? etb(request.budget) : t("common.notSet")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t("worker.reqDetail.instructionsTitle")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    { labelKey: "worker.reqDetail.measurements", value: request.measurements },
                    { labelKey: "worker.reqDetail.requiredMaterials", value: request.requiredMaterials },
                    { labelKey: "worker.reqDetail.accessInstructions", value: request.accessInstructions },
                    { labelKey: "worker.reqDetail.specialInstructions", value: request.specialInstructions },
                  ].map((row) => (
                    <div key={row.labelKey} className="grid gap-1 sm:grid-cols-[180px_1fr]">
                      <span className="text-muted-foreground">{t(row.labelKey)}</span>
                      <span className={row.value ? "whitespace-pre-wrap" : "text-muted-foreground/60"}>
                        {row.value || "—"}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t("worker.customer")}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={request.customerId?.avatarFileId ? fileUrl(request.customerId.avatarFileId) : ""} />
                    <AvatarFallback>{(request.customerId?.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{request.customerId?.name || t("worker.customer")}</p>
                    <p className="text-xs text-muted-foreground">{t("worker.reqDetail.contactNote")}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <Button
                variant="outline"
                className="w-full"
                onClick={messageCustomer}
                disabled={messaging || !request.customerId?._id}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                {messaging ? t("worker.reqDetail.openingChat") : t("worker.reqDetail.messageHomeowner")}
              </Button>

              {canAccept && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Handshake className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />{" "}
                      {t("worker.accept.cardTitle")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{t("worker.accept.cardDesc")}</p>
                    <div className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {request.budget > 0 ? t("worker.reqDetail.customerBudget") : t("worker.accept.yourPrice")}
                      </p>
                      <p className="text-xl font-bold">
                        {Number(acceptPrice) > 0 ? etb(Number(acceptPrice)) : t("common.notSet")}
                      </p>
                    </div>
                    <Button className="w-full" onClick={() => setAcceptOpen(true)}>
                      <CircleCheckBig className="mr-2 h-4 w-4" /> {t("worker.accept.acceptJob")}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      {Number(acceptPrice) > 0
                        ? t("worker.accept.acceptAt", { amount: etb(Number(acceptPrice)) })
                        : t("worker.accept.noBudgetListed")}
                    </p>
                  </CardContent>
                </Card>
              )}

              {myQuotation && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CircleCheckBig className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />{" "}
                      {t("worker.reqDetail.yourQuotation")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/60 p-4 text-center">
                      <p className="text-xs uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                        {t("worker.reqDetail.totalQuote")}
                      </p>
                      <p className="mt-1 text-3xl font-bold text-indigo-900 dark:text-indigo-200">{etb(myQuotation.total)}</p>
                      <Badge className="mt-2 bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300" variant="secondary">
                        {t(`worker.qstatus.${myQuotation.status}`)}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("worker.reqDetail.labor")}</span>
                        <span>{etb(myQuotation.laborCost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("worker.reqDetail.materials")}</span>
                        <span>{etb(myQuotation.materialsCost || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("worker.reqDetail.transport")}</span>
                        <span>{etb(myQuotation.transportCost || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("worker.reqDetail.other")}</span>
                        <span>{etb(myQuotation.otherCost || 0)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 font-medium">
                        <span>{t("worker.reqDetail.estimatedDuration")}</span>
                        <span>{myQuotation.estimatedDuration || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("worker.reqDetail.warranty")}</span>
                        <span>
                          {(myQuotation.warrantyDays || 0) === 1
                            ? t("worker.dayOne")
                            : t("worker.daysCount", { count: myQuotation.warrantyDays || 0 })}
                        </span>
                      </div>
                    </div>
                    {myQuotation.paymentPlan && myQuotation.paymentPlan.length > 0 && (
                      <div className="rounded-lg border p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("worker.paymentPlan")}
                        </p>
                        {myQuotation.paymentPlan.map((p, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{p.label}</span>
                            <span className="font-medium">{p.percent}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t("worker.reqDetail.submittedAt", { when: fmtDateTime(myQuotation.createdAt) })}
                    </p>
                    {acceptedByMe ? (
                      <Alert className="border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 [&>svg]:text-emerald-600">
                        <CircleCheckBig className="h-4 w-4" />
                        <AlertTitle>
                          {waitingOnCustomer ? t("worker.accept.waitingTitle") : t("worker.accept.updatedTitle")}
                        </AlertTitle>
                        <AlertDescription>
                          {waitingOnCustomer
                            ? t("worker.accept.waitingDesc")
                            : t("worker.accept.updatedDesc", { amount: etb(myQuotation.total) })}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>{t("worker.accept.alreadyQuoted")}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("worker.reqDetail.sendQuotation")}</CardTitle>
                </CardHeader>
                  <CardContent className="space-y-4">
                    {profile && profile.status !== "approved" && (
                      <Alert className="border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
                        <TriangleAlert className="h-4 w-4" />
                        <AlertTitle>{t("worker.reqDetail.notVerifiedTitle")}</AlertTitle>
                        <AlertDescription>
                          {t("worker.reqDetail.notVerifiedDesc")}{" "}
                          <Link href="/dashboard/worker/profile" className="underline">
                            {t("worker.reqDetail.completeProfile")}
                          </Link>
                          .
                        </AlertDescription>
                      </Alert>
                    )}

                    {!isOpen && (
                      <Alert variant="destructive">
                        <TriangleAlert className="h-4 w-4" />
                        <AlertTitle>{t("worker.reqDetail.noLongerOpenTitle")}</AlertTitle>
                        <AlertDescription>
                          {t("worker.reqDetail.noLongerOpenDesc", {
                            status: t(`worker.reqStatus.${request.status}`),
                          })}
                        </AlertDescription>
                      </Alert>
                    )}

                    {formError && (
                      <Alert variant="destructive">
                        <TriangleAlert className="h-4 w-4" />
                        <AlertTitle>{t("worker.reqDetail.quoteNotSent")}</AlertTitle>
                        <AlertDescription>{formError}</AlertDescription>
                      </Alert>
                    )}

                    {myQuotation && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          {t("worker.reqDetail.liveOffer", { amount: etb(myQuotation.total) })}
                        </AlertDescription>
                      </Alert>
                    )}

                    <fieldset disabled={!!myQuotation} className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="labor">{t("worker.reqDetail.laborCost")}</Label>
                        <Input id="labor" type="number" min={0} placeholder="2500" value={labor} onChange={(e) => setLabor(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="materials">{t("worker.reqDetail.materialsCost")}</Label>
                          <Input id="materials" type="number" min={0} value={materials} onChange={(e) => setMaterials(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="transport">{t("worker.reqDetail.transportCost")}</Label>
                          <Input id="transport" type="number" min={0} value={transport} onChange={(e) => setTransport(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="other">{t("worker.reqDetail.otherCosts")}</Label>
                        <Input id="other" type="number" min={0} value={other} onChange={(e) => setOther(e.target.value)} />
                      </div>

                      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">{t("common.total")}</p>
                        <p className="mt-1 text-3xl font-bold">{etb(total)}</p>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="duration">{t("worker.reqDetail.estimatedDuration")}</Label>
                        <Input id="duration" placeholder={t("worker.reqDetail.durationPlaceholder")} value={duration} onChange={(e) => setDuration(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="start">{t("worker.reqDetail.proposedStart")}</Label>
                          <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="end">{t("worker.reqDetail.proposedEnd")}</Label>
                          <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="warranty">{t("worker.reqDetail.warrantyDays")}</Label>
                        <Input id="warranty" type="number" min={0} value={warranty} onChange={(e) => setWarranty(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="notes">{t("worker.reqDetail.notesToCustomer")}</Label>
                        <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("worker.reqDetail.notesPlaceholder")} />
                      </div>

                      <div className="rounded-lg border p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-medium">{t("worker.paymentPlan")}</span>
                          <Badge variant={planValid ? "secondary" : "destructive"}>
                            {planSum}% / 100%
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {plan.map((row, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input
                                value={row.label}
                                onChange={(e) => setRow(i, { label: e.target.value })}
                                placeholder={t("worker.reqDetail.labelPlaceholder")}
                                className="flex-1"
                              />
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={row.percent}
                                onChange={(e) => setRow(i, { percent: n(e.target.value) })}
                                className="w-20"
                              />
                              <span className="w-5 text-sm text-muted-foreground">%</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => setPlan((prev) => prev.filter((_, idx) => idx !== i))}
                                aria-label={t("worker.reqDetail.removeRow")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPlan((prev) => [...prev, { label: "", percent: 0 }])}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" /> {t("worker.reqDetail.addRow")}
                          </Button>
                          {!planValid && (
                            <span className="text-xs font-medium text-red-600 dark:text-red-400">
                              {t("worker.reqDetail.percentTotal100")}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button className="w-full" onClick={submit} disabled={submitting || !isOpen}>
                        {submitting ? (
                          t("worker.reqDetail.submitting")
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" /> {t("worker.reqDetail.submitQuotation")}
                          </>
                        )}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        {t("worker.reqDetail.compareNote")}
                      </p>
                    </fieldset>
                  </CardContent>
                </Card>
            </div>
          </div>
        )}

        {!loading && !error && !request && (
          <Alert variant="destructive">
            <ClipboardList className="h-4 w-4" />
            <AlertDescription>{t("worker.reqDetail.notFound")}</AlertDescription>
          </Alert>
        )}

        <Dialog
          open={acceptOpen}
          onOpenChange={(o) => {
            setAcceptOpen(o);
            if (!o) setFormError("");
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("worker.accept.dialogTitle")}</DialogTitle>
              <DialogDescription>
                {request?.customerId?.name
                  ? t("worker.accept.dialogDescTo", { name: request.customerId.name })
                  : t("worker.accept.dialogDesc")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="accept-price">{t("worker.accept.agreedPrice")}</Label>
                <Input
                  id="accept-price"
                  type="number"
                  min={0}
                  value={acceptPrice}
                  onChange={(e) => setAcceptPrice(e.target.value)}
                  placeholder={request && request.budget > 0 ? String(request.budget) : t("worker.accept.pricePlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {request && request.budget > 0
                    ? t("worker.accept.prefilledHint", { amount: etb(request.budget) })
                    : t("worker.accept.noBudgetHint")}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="accept-note">{t("worker.accept.noteLabel")}</Label>
                <Textarea
                  id="accept-note"
                  rows={3}
                  value={acceptNote}
                  onChange={(e) => setAcceptNote(e.target.value)}
                  placeholder={t("worker.accept.notePlaceholder")}
                />
              </div>
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("worker.paymentPlan")}
                </p>
                {DEFAULT_PLAN.map((p) => (
                  <div key={p.label} className="flex justify-between text-sm">
                    <span>{t(`worker.plan.${p.label.toLowerCase()}`)}</span>
                    <span className="font-medium">{p.percent}%</span>
                  </div>
                ))}
              </div>
              {formError && (
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAcceptOpen(false)} disabled={accepting}>
                {t("common.cancel")}
              </Button>
              <Button onClick={acceptJob} disabled={accepting || !(Number(acceptPrice) > 0)}>
                {accepting ? (
                  t("worker.accept.sending")
                ) : (
                  <>
                    <CircleCheckBig className="mr-2 h-4 w-4" /> {t("worker.accept.sendOffer")}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}

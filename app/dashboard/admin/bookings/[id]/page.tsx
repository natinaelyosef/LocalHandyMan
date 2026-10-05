"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Image as ImageIcon,
  MapPin,
  RefreshCw,
  ScrollText,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, etb, fileUrl, fmtDate, fmtDateTime, timeAgo, URGENCY_CLASS } from "@/lib/client";
import { BOOKING_STATUSES, REJECT_REASONS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { ErrorAlert, StatusPill, useStatusLabel } from "../../_shared";

interface PopUser {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  avatarFileId?: string | null;
}

interface TimelineEntry {
  at: string;
  action: string;
  from?: string;
  to?: string;
  actorRole?: string;
  note?: string;
}

interface BookingFull {
  _id: string;
  code: string;
  title: string;
  description?: string;
  status: string;
  urgency: string;
  agreedTotal: number;
  progressPercent: number;
  createdAt: string;
  startDate?: string | null;
  expectedCompletion?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string;
  disputeOpen?: boolean;
  customerId: PopUser;
  workerId: PopUser;
  categoryId?: { _id: string; name: string } | null;
  paymentSummary: { total: number; verified: number; pending: number; remaining: number };
  location: {
    label?: string;
    region?: string;
    city?: string;
    woreda?: string;
    subCity?: string;
    area?: string;
    street?: string;
    instructions?: string;
  };
  timeline: TimelineEntry[];
}

interface Evidence {
  before?: string[];
  during?: string[];
  after?: string[];
}

interface JobPhaseT {
  _id: string;
  order: number;
  name: string;
  description?: string;
  amount?: number;
  status: string;
  percent: number;
  notes?: string;
  startDate?: string | null;
  dueDate?: string | null;
  evidence?: Evidence;
}

interface ProofT {
  _id: string;
  reference: string;
  amountPaid: number;
  status: string;
  screenshotFileId: string;
  senderName: string;
  senderAccount?: string;
  receiverAccount?: string;
  paidAt: string;
  rejectionReason?: string;
  createdAt: string;
}

interface PaymentPhaseT {
  _id: string;
  order: number;
  label: string;
  amount: number;
  paidVerified: number;
  status: string;
  rejectionReason?: string;
  paidAt?: string | null;
  proof: ProofT | null;
}

interface QuotationT {
  laborCost: number;
  materialsCost: number;
  transportCost: number;
  otherCost: number;
  total: number;
  estimatedDuration?: string;
  notes?: string;
  status?: string;
  paymentPlan?: { label: string; percent: number }[];
}

interface DetailResp {
  booking: BookingFull;
  jobPhases: JobPhaseT[];
  paymentPhases: PaymentPhaseT[];
  quotation: QuotationT | null;
  conversation: { _id: string; lastMessage?: string; lastMessageAt?: string } | null;
  viewer: { role: string; id: string };
}

function EvidenceImages({ ids, label }: { ids?: string[]; label: string }) {
  if (!ids || ids.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <a key={id} href={fileUrl(id)} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl(id)}
              alt={label}
              loading="lazy"
              decoding="async"
              className="h-16 w-16 rounded-md border object-cover transition-opacity hover:opacity-80"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function AdminBookingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const { toast } = useToast();
  const { t } = useLocale();
  const label = useStatusLabel();

  const [data, setData] = useState<DetailResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusOpen, setStatusOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const [proofAction, setProofAction] = useState<{ proof: ProofT; mode: "verify" | "reject" } | null>(null);
  const [proofReason, setProofReason] = useState("");
  const [proofNote, setProofNote] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const d = await api<DetailResp>(`/api/bookings/${id}`);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("admin.errors.loadBooking"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async () => {
    if (!targetStatus) return;
    setBusy(true);
    setActionError("");
    try {
      await api(`/api/bookings/${id}/status`, { body: { status: targetStatus, note: statusNote } });
      toast({
        title: t("admin.bdetail.statusUpdated"),
        description: t("admin.bdetail.statusChangeDesc", {
          code: data?.booking.code ?? "",
          from: label(data?.booking.status),
          to: label(targetStatus),
        }),
      });
      setStatusOpen(false);
      setStatusNote("");
      setTargetStatus("");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.statusFailed");
      setActionError(msg);
      toast({ title: t("admin.errors.statusFailed"), description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const runProofAction = async () => {
    if (!proofAction) return;
    setBusy(true);
    setActionError("");
    try {
      const body =
        proofAction.mode === "verify"
          ? { action: "verify", note: proofNote }
          : { action: "reject", reason: proofReason, note: proofNote };
      await api(`/api/payments/proofs/${proofAction.proof._id}`, { body });
      toast({
        title: proofAction.mode === "verify" ? t("admin.bdetail.proofVerified") : t("admin.bdetail.proofRejected"),
        description: proofAction.proof.reference,
      });
      setProofAction(null);
      setProofReason("");
      setProofNote("");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.actionFailed");
      setActionError(msg);
      toast({ title: t("admin.errors.actionFailed"), description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <DashboardShell role="admin" nav={ADMIN_NAV} title={t("nav.bookings")} subtitle={t("common.loading")}>
        <div className="max-w-7xl space-y-6">
          <Card>
            <CardContent className="space-y-3 py-6">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="space-y-3 py-6">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error && !data) {
    return (
      <DashboardShell role="admin" nav={ADMIN_NAV} title={t("nav.bookings")} subtitle={t("admin.bdetail.errorSubtitle")}>
        <div className="max-w-7xl space-y-4">
          <ErrorAlert error={error} onRetry={load} />
          <Button asChild variant="outline">
            <Link href="/dashboard/admin/bookings">
              <ArrowLeft className="mr-2 h-4 w-4" /> {t("admin.bdetail.backToBookings")}
            </Link>
          </Button>
        </div>
      </DashboardShell>
    );
  }

  if (!data) return null;

  const b = data.booking;
  const loc = b.location || {};
  const locLine = [loc.street, loc.area, loc.subCity, loc.woreda, loc.city, loc.region].filter(Boolean).join(", ");
  const sum = b.paymentSummary || { total: 0, verified: 0, pending: 0, remaining: 0 };
  const timeline = [...(b.timeline || [])].sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());

  return (
    <DashboardShell
      role="admin"
      nav={ADMIN_NAV}
      title={t("admin.bdetail.title", { code: b.code })}
      subtitle={b.title}
    >
      <div className="max-w-7xl space-y-6">
        {error && <ErrorAlert error={error} onRetry={load} />}

        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/admin/bookings">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("admin.bdetail.allBookings")}
          </Link>
        </Button>

        {/* header */}
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-muted-foreground">{b.code}</span>
              <StatusPill status={b.status} />
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  URGENCY_CLASS[b.urgency] || "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400"
                }`}
              >
                {label(b.urgency)}
              </span>
              {b.disputeOpen && <Badge variant="destructive">{t("admin.bookings.disputeOpen")}</Badge>}
              <Button variant="ghost" size="sm" className="ml-auto" onClick={load}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {t("common.refresh")}
              </Button>
            </div>
            <CardTitle className="text-xl">{b.title}</CardTitle>
            {b.description && <CardDescription className="text-sm">{b.description}</CardDescription>}
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-64 space-y-1.5">
                <Label>{t("admin.bdetail.forceStatus")}</Label>
                <Select value="" onValueChange={(v) => { setTargetStatus(v); setStatusOpen(true); }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("admin.bdetail.currentStatus", { status: label(b.status) })} />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_STATUSES.filter((s) => s !== b.status).map((s) => (
                      <SelectItem key={s} value={s}>
                        {label(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("admin.bdetail.progress")}</span>
                <span className="font-medium">{b.progressPercent}%</span>
              </div>
              <Progress value={b.progressPercent} />
            </div>
          </CardContent>
        </Card>

        {/* parties, location, dates */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <User className="h-4 w-4" /> {t("admin.bdetail.customer")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{b.customerId?.name}</p>
              {b.customerId?.phone && (
                <p className="text-muted-foreground">
                  <a className="hover:text-primary" href={`tel:${b.customerId.phone}`}>
                    {b.customerId.phone}
                  </a>
                </p>
              )}
              {b.customerId?.email && <p className="text-muted-foreground">{b.customerId.email}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Briefcase className="h-4 w-4" /> {t("admin.bdetail.worker")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{b.workerId?.name}</p>
              {b.workerId?.phone && (
                <p className="text-muted-foreground">
                  <a className="hover:text-primary" href={`tel:${b.workerId.phone}`}>
                    {b.workerId.phone}
                  </a>
                </p>
              )}
              {b.workerId?.email && <p className="text-muted-foreground">{b.workerId.email}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4" /> {t("admin.bdetail.locationDates")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{locLine || "—"}</p>
                {loc.instructions && <p className="text-xs text-muted-foreground">{t("admin.bdetail.note")}: {loc.instructions}</p>}
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">{t("admin.bdetail.created")}</p>
                    <p>{fmtDate(b.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("admin.bdetail.start")}</p>
                    <p>{fmtDate(b.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("admin.bdetail.expectedFinish")}</p>
                    <p>{fmtDate(b.expectedCompletion)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("admin.bdetail.completed")}</p>
                    <p>{fmtDate(b.completedAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* payment summary */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: t("admin.bdetail.agreedTotal"), value: sum.total || b.agreedTotal, cls: "" },
              { label: t("admin.bdetail.verified"), value: sum.verified, cls: "text-emerald-600 dark:text-emerald-400" },
              { label: t("admin.bdetail.pending"), value: sum.pending, cls: "text-amber-600 dark:text-amber-400" },
              { label: t("admin.bdetail.remaining"), value: sum.remaining, cls: "text-red-600 dark:text-red-400" },
            ].map((c) => (
              <Card key={c.label} className="py-4">
                <CardContent className="px-4">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
                  <p className={`mt-1 text-lg font-bold ${c.cls}`}>{etb(c.value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* payment phases */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="h-4 w-4" /> {t("admin.bdetail.paymentPhases")}
              </CardTitle>
              <CardDescription>
                {t("admin.bdetail.phaseCount", { n: data.paymentPhases.length })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.paymentPhases.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("admin.bdetail.noPaymentPhases")}</p>
              )}
            {data.paymentPhases.map((ph) => (
              <div key={ph._id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">#{ph.order}</span>
                    <span className="text-sm font-medium">{ph.label}</span>
                    <StatusPill status={ph.status} />
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">{etb(ph.amount)}</span>
                    {ph.paidVerified > 0 && (
                      <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">{t("admin.bdetail.verifiedAmount", { amount: etb(ph.paidVerified) })}</span>
                    )}
                  </div>
                </div>

                {ph.rejectionReason && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{t("admin.bdetail.rejectionReason")}: {ph.rejectionReason}</p>
                )}

                {ph.proof && (
                  <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md bg-muted/40 p-3">
                    <a href={fileUrl(ph.proof.screenshotFileId)} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fileUrl(ph.proof.screenshotFileId)}
                        alt={t("admin.bdetail.proofScreenshot")}
                        loading="lazy"
                        decoding="async"
                        className="h-16 w-16 rounded-md border object-cover"
                      />
                    </a>
                    <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                      <p className="text-sm font-medium">{ph.proof.reference}</p>
                      <p className="text-muted-foreground">
                        {t("admin.bdetail.paidBy", { amount: etb(ph.proof.amountPaid), name: ph.proof.senderName, date: fmtDate(ph.proof.paidAt) })}
                      </p>
                      <p className="text-muted-foreground">{t("admin.bdetail.submitted", { time: timeAgo(ph.proof.createdAt) })}</p>
                      <StatusPill status={ph.proof.status} />
                    </div>
                    {ph.proof.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setProofAction({ proof: ph.proof as ProofT, mode: "verify" });
                            setActionError("");
                            setProofNote("");
                          }}
                        >
                          <BadgeCheck className="mr-1.5 h-4 w-4" /> {t("admin.verify")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy}
                          onClick={() => {
                            setProofAction({ proof: ph.proof as ProofT, mode: "reject" });
                            setActionError("");
                            setProofReason("");
                            setProofNote("");
                          }}
                        >
                          <XCircle className="mr-1.5 h-4 w-4" /> {t("admin.reject")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

          {/* job phases */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Briefcase className="h-4 w-4" /> {t("admin.bdetail.jobPhases")}
              </CardTitle>
              <CardDescription>{t("admin.bdetail.phaseCount", { n: data.jobPhases.length })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.jobPhases.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("admin.bdetail.noJobPhases")}</p>
              )}
            {data.jobPhases.map((jp) => (
              <div key={jp._id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">#{jp.order}</span>
                    <span className="text-sm font-medium">{jp.name}</span>
                    <StatusPill status={jp.status} />
                  </div>
                  <span className="text-sm font-medium">{etb(jp.amount || 0)}</span>
                </div>
                {jp.description && <p className="mt-1 text-xs text-muted-foreground">{jp.description}</p>}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("admin.bdetail.completion")}</span>
                    <span className="font-medium">{jp.percent}%</span>
                  </div>
                  <Progress value={jp.percent} className="h-1.5" />
                </div>
                {jp.notes && <p className="mt-2 text-xs italic text-muted-foreground">“{jp.notes}”</p>}
                <div className="mt-3 flex flex-wrap gap-4">
                  <EvidenceImages ids={jp.evidence?.before} label={t("admin.bdetail.before")} />
                  <EvidenceImages ids={jp.evidence?.during} label={t("admin.bdetail.during")} />
                  <EvidenceImages ids={jp.evidence?.after} label={t("admin.bdetail.after")} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

          {/* quotation + timeline */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ScrollText className="h-4 w-4" /> {t("admin.bdetail.quotationBreakdown")}
                </CardTitle>
                <CardDescription>
                  {data.quotation
                    ? t("admin.bdetail.quotationStatus", {
                        status: label(data.quotation.status),
                        duration: data.quotation.estimatedDuration ? ` · ${data.quotation.estimatedDuration}` : "",
                      })
                    : t("admin.bdetail.noQuotationLinked")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!data.quotation ? (
                  <p className="text-muted-foreground">{t("admin.bdetail.noQuotationData")}</p>
                ) : (
                  <>
                    {[
                      { label: t("admin.bdetail.labour"), value: data.quotation.laborCost },
                      { label: t("admin.bdetail.materials"), value: data.quotation.materialsCost },
                      { label: t("admin.bdetail.transport"), value: data.quotation.transportCost },
                      { label: t("admin.bdetail.otherCost"), value: data.quotation.otherCost },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between border-b pb-1.5 last:border-0">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span>{etb(row.value)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-1 font-semibold">
                      <span>{t("common.total")}</span>
                      <span>{etb(data.quotation.total)}</span>
                    </div>
                    {data.quotation.paymentPlan && data.quotation.paymentPlan.length > 0 && (
                      <div className="pt-2">
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {t("admin.bdetail.paymentPlan")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {data.quotation.paymentPlan.map((p, i) => (
                            <Badge key={i} variant="secondary">
                              {p.label} · {p.percent}%
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {data.quotation.notes && (
                      <p className="pt-2 text-xs italic text-muted-foreground">“{data.quotation.notes}”</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4" /> {t("admin.bdetail.timeline")}
                </CardTitle>
                <CardDescription>{t("admin.bdetail.latestFirst")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {timeline.length === 0 && <p className="text-sm text-muted-foreground">{t("admin.bdetail.noTimeline")}</p>}
                {timeline.map((entry, i) => (
                  <div key={i} className="relative border-l-2 border-muted pl-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{label(entry.action)}</span>
                      <span className="text-[11px] text-muted-foreground">{fmtDateTime(entry.at)}</span>
                    </div>
                    {(entry.from || entry.to) && (
                      <p className="text-xs text-muted-foreground">
                        {label(entry.from) || "—"} → {label(entry.to) || "—"}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t("admin.bdetail.byActor", { actor: entry.actorRole || t("admin.actor.system") })}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {data.conversation && (
            <Alert>
              <ImageIcon className="h-4 w-4" />
              <AlertTitle>{t("admin.bdetail.messages")}</AlertTitle>
              <AlertDescription>
                {t("admin.bdetail.conversationDesc", { id: data.conversation._id })}
                {data.conversation.lastMessageAt ? ` · ${t("admin.bdetail.lastMessage", { time: timeAgo(data.conversation.lastMessageAt) })}` : ""}.
              </AlertDescription>
            </Alert>
          )}

          {/* status change dialog */}
          <Dialog open={statusOpen} onOpenChange={(o) => !o && setStatusOpen(false)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("admin.bdetail.forceTitle")}</DialogTitle>
                <DialogDescription>{t("admin.bdetail.forceDesc")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">{t("admin.bdetail.from")}:</span> <StatusPill status={b.status} />
                  </p>
                  <p className="mt-2">
                    <span className="text-muted-foreground">{t("admin.bdetail.to")}:</span> <StatusPill status={targetStatus} />
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status-note">{t("admin.note.optional")}</Label>
                  <Textarea
                    id="status-note"
                    rows={3}
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder={t("admin.bdetail.overridePlaceholder")}
                  />
                </div>
                {actionError && (
                  <Alert variant="destructive">
                    <AlertDescription>{actionError}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStatusOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button disabled={busy || !targetStatus} onClick={changeStatus}>
                  {busy ? t("admin.bdetail.updating") : t("admin.bdetail.confirmChange")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* proof action dialog */}
          <Dialog open={!!proofAction} onOpenChange={(o) => !o && setProofAction(null)}>
            <DialogContent>
              {proofAction && (
                <>
                  <DialogHeader>
                    <DialogTitle>
                      {proofAction.mode === "verify" ? t("admin.bdetail.verifyProof") : t("admin.bdetail.rejectProof")}
                    </DialogTitle>
                    <DialogDescription>
                      {proofAction.proof.reference} · {etb(proofAction.proof.amountPaid)}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fileUrl(proofAction.proof.screenshotFileId)}
                      alt={t("admin.bdetail.proofScreenshot")}
                      loading="lazy"
                      decoding="async"
                      className="max-h-56 w-full rounded-md border object-contain bg-muted"
                    />
                    {proofAction.mode === "reject" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="proof-reason">{t("common.reason")}</Label>
                        <Select value={proofReason} onValueChange={setProofReason}>
                          <SelectTrigger id="proof-reason">
                            <SelectValue placeholder={t("admin.selectReason")} />
                          </SelectTrigger>
                          <SelectContent>
                            {REJECT_REASONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="proof-note">{t("admin.note.optional")}</Label>
                      <Textarea
                        id="proof-note"
                        rows={2}
                        value={proofNote}
                        onChange={(e) => setProofNote(e.target.value)}
                        placeholder={t("admin.note.internal")}
                      />
                    </div>
                    {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setProofAction(null)}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      variant={proofAction.mode === "reject" ? "destructive" : "default"}
                      disabled={busy || (proofAction.mode === "reject" && !proofReason)}
                      onClick={runProofAction}
                    >
                      {busy ? t("admin.working") : proofAction.mode === "verify" ? t("admin.confirmVerify") : t("admin.confirmReject")}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
      </div>
    </DashboardShell>
  );
}

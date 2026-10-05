"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CircleAlert,
  CircleCheckBig,
  ClipboardCheck,
  Clock,
  Gauge,
  History,
  Hourglass,
  Info,
  ListChecks,
  LoaderCircle,
  MapPin,
  MessageSquare,
  Navigation,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Scale,
  Trash2,
  TriangleAlert,
  Truck,
  Upload,
  UserCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { WORKER_NAV } from "@/components/dashboard/nav-config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, etb, fileUrl, fmtDate, fmtDateTime, statusClass, URGENCY_CLASS } from "@/lib/client";
import { useLocale } from "@/context/locale";
import { useToast } from "@/hooks/use-toast";
import { ChatPanel } from "@/components/dashboard/chat-panel";
import { RaiseDisputeDialog } from "@/components/dashboard/disputes-ui";
import { COMPLAINT_CATEGORIES } from "@/lib/constants";
import {
  conversationIdOf,
  EmptyState,
  ErrorState,
  PageSkeleton,
  useErrMsg,
  type ConversationRefT,
  type JobPhaseT,
  type PaymentPhaseT,
  type QuotationT,
  type TimelineEntryT,
} from "../../_shared";

type BookingDetailT = {
  _id: string;
  code: string;
  title: string;
  description?: string;
  status: string;
  urgency?: string;
  agreedTotal: number;
  startDate?: string | null;
  expectedCompletion?: string | null;
  createdAt: string;
  completedAt?: string | null;
  progressPercent?: number;
  warrantyDays?: number;
  disputeOpen?: boolean;
  customerId: { _id: string; name: string; phone?: string; email?: string; avatarFileId?: string | null };
  location?: {
    label?: string;
    region?: string;
    city?: string;
    woreda?: string;
    area?: string;
    street?: string;
    latitude?: number | null;
    longitude?: number | null;
    instructions?: string;
  };
  paymentSummary?: { total: number; verified: number; pending: number; remaining: number };
  conversationId?: string | { _id: string } | null;
  allowedTransitions?: Record<string, string[]>;
  timeline?: TimelineEntryT[];
};

type JobDetailT = {
  booking: BookingDetailT;
  jobPhases: JobPhaseT[];
  paymentPhases: PaymentPhaseT[];
  quotation: QuotationT | null;
  request: {
    _id: string;
    title?: string;
    description?: string;
    measurements?: string;
    requiredMaterials?: string;
    accessInstructions?: string;
    specialInstructions?: string;
    mediaFileIds?: string[];
    preferredDate?: string | null;
    preferredTime?: string;
  } | null;
  conversation: ConversationRefT | null;
  accounts: { _id: string; bank?: string; accountName?: string; accountNumber?: string; branch?: string; instructions?: string }[];
  viewer: { role: string; id: string };
};

type ActionKind = "simple" | "progress" | "confirm" | "reason";

const ACTION_META: Record<string, { labelKey: string; icon: LucideIcon; variant: ButtonProps["variant"]; kind: ActionKind }> = {
  SCHEDULED: { labelKey: "worker.action.scheduled", icon: CalendarDays, variant: "default", kind: "simple" },
  WORKER_ON_THE_WAY: { labelKey: "worker.action.onTheWay", icon: Truck, variant: "default", kind: "simple" },
  WORK_STARTED: { labelKey: "worker.action.startJob", icon: CircleCheckBig, variant: "default", kind: "simple" },
  IN_PROGRESS: { labelKey: "worker.action.updateProgress", icon: Gauge, variant: "default", kind: "progress" },
  AWAITING_CUSTOMER: { labelKey: "worker.action.handOver", icon: UserCheck, variant: "outline", kind: "simple" },
  READY_FOR_REVIEW: { labelKey: "worker.action.readyForReview", icon: ClipboardCheck, variant: "outline", kind: "simple" },
  COMPLETED: { labelKey: "worker.action.markCompleted", icon: CircleCheckBig, variant: "default", kind: "confirm" },
  DISPUTED: { labelKey: "worker.action.reportProblem", icon: TriangleAlert, variant: "destructive", kind: "reason" },
  CANCELLED: { labelKey: "worker.action.cancelJob", icon: XCircle, variant: "destructive", kind: "reason" },
};

const ACTION_ORDER = [
  "SCHEDULED",
  "WORKER_ON_THE_WAY",
  "WORK_STARTED",
  "IN_PROGRESS",
  "AWAITING_CUSTOMER",
  "READY_FOR_REVIEW",
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
];

const PHASE_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "worker.phaseStatus.not_started",
  IN_PROGRESS: "worker.phaseStatus.in_progress",
  AWAITING_CUSTOMER: "worker.phaseStatus.awaiting_customer",
  COMPLETED: "worker.phaseStatus.completed",
  CANCELLED: "worker.phaseStatus.cancelled",
};

const EVIDENCE_KINDS: { key: "before" | "during" | "after"; labelKey: string; uploadKey: string }[] = [
  { key: "before", labelKey: "worker.evidence.before", uploadKey: "worker.evidence.uploadBefore" },
  { key: "during", labelKey: "worker.evidence.during", uploadKey: "worker.evidence.uploadDuring" },
  { key: "after", labelKey: "worker.evidence.after", uploadKey: "worker.evidence.uploadAfter" },
];

const DEFAULT_PLAN = [
  { label: "Advance", percent: 30 },
  { label: "Progress", percent: 40 },
  { label: "Final", percent: 30 },
];

function n(v: string): number {
  const x = Number(v);
  return isNaN(x) || x < 0 ? 0 : x;
}

function prettyAction(action: string): string {
  const s = action.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function WorkerJobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { toast } = useToast();
  const { t } = useLocale();
  const errMsg = useErrMsg();
  const router = useRouter();

  const [data, setData] = useState<JobDetailT | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<{ status: string; message: string } | null>(null);

  const [progressOpen, setProgressOpen] = useState(false);
  const [progressPercent, setProgressPercent] = useState(50);
  const [progressNote, setProgressNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonStatus, setReasonStatus] = useState("");
  const [reason, setReason] = useState("");

  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [phaseName, setPhaseName] = useState("");
  const [phaseDesc, setPhaseDesc] = useState("");
  const [phaseAmount, setPhaseAmount] = useState("");
  const [phaseDue, setPhaseDue] = useState("");
  const [editPhase, setEditPhase] = useState<JobPhaseT | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPercent, setEditPercent] = useState(0);
  const [busyKey, setBusyKey] = useState("");

  const [planOpen, setPlanOpen] = useState(false);
  const [planRows, setPlanRows] = useState<{ label: string; percent: number }[]>(DEFAULT_PLAN);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api<JobDetailT>(`/api/bookings/${id}`);
      setData(d);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [errMsg, id]);

  useEffect(() => {
    load();
  }, [load]);

  const booking = data?.booking;
  const paymentPhases = data?.paymentPhases || [];
  const jobPhases = data?.jobPhases || [];
  const summary = booking?.paymentSummary || { total: booking?.agreedTotal || 0, verified: 0, pending: 0, remaining: booking?.agreedTotal || 0 };

  /* ------------------------------ status actions ------------------------------ */

  const runStatus = async (status: string, extra: { reason?: string; note?: string; progressPercent?: number } = {}) => {
    setActing(true);
    setActionError(null);
    try {
      await api(`/api/bookings/${id}/status`, { body: { status, ...extra } });
      const meta = ACTION_META[status];
      toast({
        title: t("worker.jobDetail.statusUpdatedTitle"),
        description: t("worker.jobDetail.statusUpdatedDesc", {
          action: meta ? t(meta.labelKey) : status,
          status: t(`worker.status.${status.toLowerCase()}`),
        }),
      });
      await load();
    } catch (err) {
      const message = errMsg(err);
      setActionError({ status, message });
      toast({ title: t("worker.jobDetail.actionFailedTitle"), description: message, variant: "destructive" });
    } finally {
      setActing(false);
      setProgressOpen(false);
      setConfirmOpen(false);
      setReasonOpen(false);
      setReason("");
    }
  };

  const onActionClick = (status: string) => {
    const meta = ACTION_META[status];
    if (!meta) return;
    if (meta.kind === "simple") {
      void runStatus(status);
    } else if (meta.kind === "progress") {
      setProgressPercent(booking?.progressPercent || 0);
      setProgressNote("");
      setProgressOpen(true);
    } else if (meta.kind === "confirm") {
      setConfirmOpen(true);
    } else if (meta.kind === "reason") {
      setReasonStatus(status);
      setReason("");
      setReasonOpen(true);
    }
  };

  const allowedActions = ACTION_ORDER.filter(
    (s) => booking?.allowedTransitions && Object.prototype.hasOwnProperty.call(booking.allowedTransitions, s) && ACTION_META[s]
  );

  /* --------------------------------- phases --------------------------------- */

  const patchPhase = async (phaseId: string, body: Record<string, unknown>, okMessageKey: string) => {
    setBusyKey(phaseId);
    try {
      await api(`/api/job-phases/${phaseId}`, { method: "PATCH", body });
      toast({ title: t(okMessageKey) });
      await load();
    } catch (err) {
      toast({ title: t("worker.phase.phaseUpdateFailed"), description: errMsg(err), variant: "destructive" });
    } finally {
      setBusyKey("");
    }
  };

  const addPhase = async () => {
    if (!phaseName.trim()) {
      toast({ title: t("worker.phase.nameRequired"), variant: "destructive" });
      return;
    }
    setBusyKey("add-phase");
    try {
      await api(`/api/job-phases/${id}`, {
        body: {
          name: phaseName.trim(),
          description: phaseDesc.trim(),
          amount: n(phaseAmount),
          dueDate: phaseDue || undefined,
        },
      });
      toast({ title: t("worker.phase.added") });
      setAddPhaseOpen(false);
      setPhaseName("");
      setPhaseDesc("");
      setPhaseAmount("");
      setPhaseDue("");
      await load();
    } catch (err) {
      toast({ title: t("worker.phase.addFailed"), description: errMsg(err), variant: "destructive" });
    } finally {
      setBusyKey("");
    }
  };

  const saveEditPhase = async () => {
    if (!editPhase) return;
    setBusyKey(`edit-${editPhase._id}`);
    try {
      await api(`/api/job-phases/${editPhase._id}`, {
        method: "PATCH",
        body: { notes: editNotes, amount: n(editAmount), percent: editPercent },
      });
      toast({ title: t("worker.phase.updated") });
      setEditPhase(null);
      await load();
    } catch (err) {
      toast({ title: t("worker.phase.phaseUpdateFailed"), description: errMsg(err), variant: "destructive" });
    } finally {
      setBusyKey("");
    }
  };

  const uploadEvidence = async (phaseId: string, kind: "before" | "during" | "after", file: File) => {
    const key = `up-${phaseId}-${kind}`;
    setBusyKey(key);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", "work_evidence");
      const up = await api<{ fileId: string }>("/api/uploads", { form });
      await api(`/api/job-phases/${phaseId}`, { method: "PATCH", body: { evidence: { [kind]: [up.fileId] } } });
      toast({ title: t("worker.phase.evidenceUploaded") });
      await load();
    } catch (err) {
      toast({ title: t("worker.phase.uploadFailed"), description: errMsg(err), variant: "destructive" });
    } finally {
      setBusyKey("");
    }
  };

  /* -------------------------------- payments -------------------------------- */

  const planLocked = paymentPhases.some((p) => ["PROOF_SUBMITTED", "UNDER_VERIFICATION", "VERIFIED"].includes(p.status));
  const planSum = planRows.reduce((s, r) => s + (Number.isFinite(r.percent) ? r.percent : 0), 0);

  const openPlanDialog = () => {
    if (paymentPhases.length && summary.total > 0) {
      const rows = paymentPhases.map((p, i) => ({
        label: p.label,
        percent: i === paymentPhases.length - 1 ? 0 : Math.round((p.amount / summary.total) * 100),
      }));
      const sum = rows.reduce((s, r) => s + r.percent, 0);
      rows[rows.length - 1].percent = Math.max(0, 100 - sum);
      setPlanRows(rows);
    } else {
      setPlanRows(DEFAULT_PLAN.map((r) => ({ ...r })));
    }
    setPlanOpen(true);
  };

  const savePlan = async () => {
    if (planSum !== 100) {
      toast({
        title: t("worker.plan.percent100Title"),
        description: t("worker.plan.currentlyPercent", { percent: planSum }),
        variant: "destructive",
      });
      return;
    }
    if (planRows.some((r) => !r.label.trim())) {
      toast({ title: t("worker.plan.needsLabel"), variant: "destructive" });
      return;
    }
    setBusyKey("plan");
    try {
      await api(`/api/bookings/${id}/payment-phases`, {
        body: { plan: planRows.map((r) => ({ label: r.label.trim(), percent: r.percent })) },
      });
      toast({ title: t("worker.plan.configured") });
      setPlanOpen(false);
      await load();
    } catch (err) {
      toast({ title: t("worker.plan.configFailed"), description: errMsg(err), variant: "destructive" });
    } finally {
      setBusyKey("");
    }
  };

  /* -------------------------------- rendering -------------------------------- */

  if (loading) {
    return (
      <DashboardShell role="worker" nav={WORKER_NAV} title={t("worker.jobDetail.shellTitle")} subtitle={t("common.loading")}>
        <div className="mx-auto max-w-7xl">
          <PageSkeleton rows={3} />
        </div>
      </DashboardShell>
    );
  }

  if (error || !data || !booking) {
    return (
      <DashboardShell role="worker" nav={WORKER_NAV} title={t("worker.jobDetail.shellTitle")} subtitle={t("common.error")}>
        <div className="mx-auto max-w-7xl space-y-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/worker/jobs">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> {t("worker.jobDetail.backToJobs")}
            </Link>
          </Button>
          <ErrorState message={error || t("worker.jobDetail.notFound")} onRetry={load} />
        </div>
      </DashboardShell>
    );
  }

  const customer = booking.customerId;
  const lat = booking.location?.latitude;
  const lng = booking.location?.longitude;
  const hasCoords = typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng);
  const addressText = [booking.location?.label, booking.location?.area, booking.location?.woreda, booking.location?.city, booking.location?.region]
    .filter(Boolean)
    .join(", ");
  const conversationId = conversationIdOf(booking, data.conversation);

  return (
    <DashboardShell
      role="worker"
      nav={WORKER_NAV}
      title={booking.title}
      subtitle={`${booking.code} · ${customer?.name || t("worker.customer")}`}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/dashboard/worker/jobs">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> {t("worker.jobDetail.backToJobs")}
          </Link>
        </Button>

        {!booking.disputeOpen && (
          <div className="-mt-3">
            <Button variant="outline" size="sm" onClick={() => setDisputeOpen(true)}>
              <Scale className="mr-1.5 h-3.5 w-3.5" /> {t("common.dispute.raise")}
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">{booking.code}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(booking.status)}`}>
                    {t(`worker.status.${booking.status.toLowerCase()}`)}
                  </span>
                  {booking.urgency && booking.urgency !== "normal" && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${URGENCY_CLASS[booking.urgency]}`}>
                      {t(`common.urgency.${booking.urgency}`)}
                    </span>
                  )}
                </div>
                <h2 className="mt-1 truncate text-xl font-semibold">{booking.title}</h2>
              </div>
              <div className="w-full sm:w-64">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5" /> {t("worker.jobDetail.jobProgress")}
                  </span>
                  <span className="font-semibold text-foreground">{booking.progressPercent || 0}%</span>
                </div>
                <Progress value={booking.progressPercent || 0} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0 sm:w-auto">
            <TabsTrigger value="overview">{t("nav.overview")}</TabsTrigger>
            <TabsTrigger value="phases">{t("worker.jobDetail.tabPhases")}</TabsTrigger>
            <TabsTrigger value="payments">{t("nav.payments")}</TabsTrigger>
            <TabsTrigger value="timeline">{t("worker.jobDetail.tabTimeline")}</TabsTrigger>
            <TabsTrigger value="messages">{t("nav.messages")}</TabsTrigger>
          </TabsList>

          {/* -------------------------------- OVERVIEW ------------------------------- */}
          <TabsContent value="overview" className="space-y-6">
            {actionError && (
              actionError.status === "WORK_STARTED" ? (
                <Alert className="border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>{t("worker.jobDetail.advanceVerifyTitle")}</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="font-medium">{actionError.message}</p>
                    <p className="text-sm">{t("worker.jobDetail.advanceVerifyDesc")}</p>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/dashboard/worker/payments">
                        <Wallet className="mr-1.5 h-4 w-4" /> {t("worker.jobDetail.viewPaymentRecords")}
                      </Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <CircleAlert className="h-4 w-4" />
                  <AlertTitle>{t("worker.jobDetail.actionNotCompleted")}</AlertTitle>
                  <AlertDescription>{actionError.message}</AlertDescription>
                </Alert>
              )
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Phone className="h-4 w-4 text-primary" /> {t("worker.customer")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="font-medium">{customer?.name || "—"}</p>
                  {customer?.phone ? (
                    <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {customer.phone}
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("worker.jobDetail.noPhone")}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <MapPin className="h-4 w-4 text-primary" /> {t("common.location")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">{addressText || t("worker.jobDetail.noAddress")}</p>
                  {booking.location?.instructions && (
                    <p className="text-xs text-muted-foreground">
                      {t("worker.jobDetail.access", { instructions: booking.location.instructions })}
                    </p>
                  )}
                  {hasCoords ? (
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">
                        <Navigation className="mr-1.5 h-3.5 w-3.5" /> {t("worker.jobDetail.openMaps")}
                      </a>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("worker.jobDetail.noGps")}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <CalendarDays className="h-4 w-4 text-primary" /> {t("worker.jobDetail.dates")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t("worker.jobDetail.booked")}</span>
                    <span>{fmtDate(booking.createdAt)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t("worker.jobDetail.start")}</span>
                    <span>{booking.startDate ? fmtDate(booking.startDate) : t("common.notSet")}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t("worker.jobDetail.expectedCompletion")}</span>
                    <span>{booking.expectedCompletion ? fmtDate(booking.expectedCompletion) : t("common.notSet")}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{t("worker.reqDetail.warranty")}</span>
                    <span>
                      {(booking.warrantyDays || 0) === 1
                        ? t("worker.dayOne")
                        : t("worker.daysCount", { count: booking.warrantyDays || 0 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: t("worker.jobDetail.totalAgreed"), value: summary.total, cls: "text-foreground", icon: Receipt },
                { label: t("worker.jobs.verified"), value: summary.verified, cls: "text-emerald-700 dark:text-emerald-300", icon: CircleCheckBig },
                { label: t("worker.jobs.pending"), value: summary.pending, cls: "text-amber-700 dark:text-amber-300", icon: Hourglass },
                { label: t("worker.jobs.remaining"), value: summary.remaining, cls: "text-foreground", icon: Wallet },
              ].map((c) => (
                <Card key={c.label}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <c.icon className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground">{c.label}</p>
                      <p className={`text-lg font-bold ${c.cls}`}>{etb(c.value)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <Info className="h-4 w-4 text-primary" /> {t("worker.jobDetail.updateJob")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {allowedActions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("worker.jobDetail.noUpdates")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allowedActions.map((s) => {
                      const meta = ACTION_META[s];
                      return (
                        <Button
                          key={s}
                          variant={meta.variant}
                          size="sm"
                          disabled={acting}
                          onClick={() => onActionClick(s)}
                        >
                          {acting ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <meta.icon className="mr-1.5 h-4 w-4" />}
                          {t(meta.labelKey)}
                        </Button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{t("worker.jobDetail.timelineNote")}</p>
              </CardContent>
            </Card>

            {data.quotation && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Receipt className="h-4 w-4 text-primary" /> {t("worker.jobDetail.acceptedQuotation")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">{t("common.total")}</p>
                    <p className="font-semibold">{etb(data.quotation.total)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("worker.jobDetail.duration")}</p>
                    <p className="font-semibold">{data.quotation.estimatedDuration || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("worker.jobDetail.proposedDates")}</p>
                    <p className="font-semibold">
                      {data.quotation.proposedStartDate ? fmtDate(data.quotation.proposedStartDate) : "—"} →{" "}
                      {data.quotation.proposedEndDate ? fmtDate(data.quotation.proposedEndDate) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("worker.reqDetail.warranty")}</p>
                    <p className="font-semibold">
                      {(data.quotation.warrantyDays || 0) === 1
                        ? t("worker.dayOne")
                        : t("worker.daysCount", { count: data.quotation.warrantyDays || 0 })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* --------------------------------- PHASES -------------------------------- */}
          <TabsContent value="phases" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{t("worker.phase.intro")}</p>
              <Button size="sm" onClick={() => setAddPhaseOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> {t("worker.phase.add")}
              </Button>
            </div>

            {jobPhases.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title={t("worker.phase.emptyTitle")}
                hint={t("worker.phase.emptyHint")}
                action={
                  <Button size="sm" onClick={() => setAddPhaseOpen(true)}>
                    <Plus className="mr-1.5 h-4 w-4" /> {t("worker.phase.addFirst")}
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                {jobPhases.map((ph) => (
                  <Card key={ph._id}>
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {ph.order}
                            </span>
                            <h3 className="font-semibold">{ph.name}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(ph.status)}`}>
                              {PHASE_STATUS_LABEL[ph.status] ? t(PHASE_STATUS_LABEL[ph.status]) : ph.status}
                            </span>
                          </div>
                          {ph.description && <p className="mt-1.5 text-sm text-muted-foreground">{ph.description}</p>}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditPhase(ph);
                              setEditNotes(ph.notes || "");
                              setEditAmount(String(ph.amount || 0));
                              setEditPercent(ph.percent || 0);
                            }}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" /> {t("common.edit")}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{t("worker.phase.completion")}</span>
                          <span>{ph.percent || 0}%</span>
                        </div>
                        <Progress value={ph.percent || 0} className="h-2" />
                      </div>

                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />{" "}
                          {t("worker.phase.due", {
                            date: ph.dueDate ? fmtDate(ph.dueDate) : t("worker.notSetLower"),
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {t("worker.phase.started", { date: ph.startedAt ? fmtDate(ph.startedAt) : "—" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <CircleCheckBig className="h-3.5 w-3.5" />{" "}
                          {t("worker.phase.completedOn", { date: ph.completedAt ? fmtDate(ph.completedAt) : "—" })}
                        </span>
                        <span>{t("worker.phase.amount", { amount: etb(ph.amount || 0) })}</span>
                      </div>

                      {ph.notes && (
                        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {t("common.notes")}
                          </p>
                          <p className="whitespace-pre-wrap">{ph.notes}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {ph.status !== "IN_PROGRESS" && ph.status !== "COMPLETED" && ph.status !== "CANCELLED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyKey === ph._id}
                            onClick={() => patchPhase(ph._id, { status: "IN_PROGRESS" }, "worker.phase.startedToast")}
                          >
                            {t("worker.phase.start")}
                          </Button>
                        )}
                        {ph.status === "IN_PROGRESS" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyKey === ph._id}
                            onClick={() => patchPhase(ph._id, { status: "AWAITING_CUSTOMER" }, "worker.phase.handedOver")}
                          >
                            <UserCheck className="mr-1.5 h-3.5 w-3.5" /> {t("worker.phase.handToCustomer")}
                          </Button>
                        )}
                        {ph.status === "AWAITING_CUSTOMER" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyKey === ph._id}
                            onClick={() => patchPhase(ph._id, { status: "IN_PROGRESS" }, "worker.phase.resumed")}
                          >
                            {t("worker.phase.backToWork")}
                          </Button>
                        )}
                        {(ph.status === "IN_PROGRESS" || ph.status === "AWAITING_CUSTOMER") && (
                          <Button
                            size="sm"
                            disabled={busyKey === ph._id}
                            onClick={() => patchPhase(ph._id, { status: "COMPLETED" }, "worker.phase.completedToast")}
                          >
                            <CircleCheckBig className="mr-1.5 h-3.5 w-3.5" /> {t("worker.phase.complete")}
                          </Button>
                        )}
                        {ph.status === "COMPLETED" && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            <CircleCheckBig className="h-3.5 w-3.5" /> {t("worker.phase.done")}
                          </span>
                        )}
                      </div>

                      <Separator />

                      <div className="grid gap-4 sm:grid-cols-3">
                        {EVIDENCE_KINDS.map(({ key, labelKey, uploadKey }) => {
                          const files = (ph.evidence && ph.evidence[key]) || [];
                          const upKey = `up-${ph._id}-${key}`;
                          const label = t(labelKey);
                          return (
                            <div key={key} className="rounded-lg border p-3">
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {label}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{files.length}/10</span>
                              </div>
                              {files.length > 0 && (
                                <div className="mb-2 grid grid-cols-3 gap-1.5">
                                  {files.map((fid) => (
                                    <div key={fid} className="group relative overflow-hidden rounded border">
                                      <a href={fileUrl(fid)} target="_blank" rel="noreferrer">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={fileUrl(fid)} alt={`${label} evidence`} loading="lazy" decoding="async" className="h-14 w-full object-cover" />
                                      </a>
                                      <button
                                        onClick={() =>
                                          patchPhase(ph._id, { removeEvidence: { kind: key, fileId: fid } }, "worker.phase.evidenceRemoved")
                                        }
                                        className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                                        aria-label={t("worker.phase.removeEvidence")}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <label
                                className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground transition hover:border-primary hover:text-primary ${
                                  busyKey === upKey ? "pointer-events-none opacity-60" : ""
                                }`}
                              >
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void uploadEvidence(ph._id, key, f);
                                    e.target.value = "";
                                  }}
                                />
                                {busyKey === upKey ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Upload className="h-3.5 w-3.5" />
                                )}
                                {t(uploadKey)}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* -------------------------------- PAYMENTS ------------------------------- */}
          <TabsContent value="payments" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-sm text-muted-foreground">{t("worker.pay.intro")}</p>
              <Button size="sm" variant="outline" onClick={openPlanDialog} disabled={planLocked}>
                {t("worker.pay.configurePlan")}
              </Button>
            </div>

            {planLocked && <p className="text-xs text-amber-700 dark:text-amber-300">{t("worker.pay.planLocked")}</p>}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: t("worker.jobDetail.totalAgreed"), value: summary.total, cls: "" },
                { label: t("worker.jobs.verified"), value: summary.verified, cls: "text-emerald-700 dark:text-emerald-300" },
                { label: t("worker.jobs.pending"), value: summary.pending, cls: "text-amber-700 dark:text-amber-300" },
                { label: t("worker.jobs.remaining"), value: summary.remaining, cls: "" },
              ].map((c) => (
                <Card key={c.label}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className={`mt-1 text-xl font-bold ${c.cls}`}>{etb(c.value)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {paymentPhases.length === 0 ? (
              <EmptyState
                icon={Banknote}
                title={t("worker.pay.noPhasesTitle")}
                hint={t("worker.pay.noPhasesHint")}
              />
            ) : (
              <Card>
                <CardContent className="divide-y p-0">
                  {paymentPhases.map((p) => (
                    <div key={p._id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">
                            {p.order}. {p.label}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(p.status)}`}>
                            {t(`worker.payStatus.${p.status.toLowerCase()}`)}
                          </span>
                          {p.purpose && <span className="text-xs text-muted-foreground">{p.purpose}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                          <span>{t("worker.pay.due", { date: p.dueDate ? fmtDate(p.dueDate) : "—" })}</span>
                          <span>{t("worker.pay.verifiedAmount", { amount: etb(p.paidVerified || 0) })}</span>
                          {p.verifiedAt && <span>{t("worker.pay.verifiedOn", { date: fmtDate(p.verifiedAt) })}</span>}
                          {p.rejectionReason && (
                            <span className="text-red-600 dark:text-red-400">
                              {t("worker.pay.rejection", { reason: p.rejectionReason })}
                            </span>
                          )}
                        </div>
                        {p.proof && (
                          <div className="rounded-lg border bg-muted/40 p-2.5 text-xs">
                            <div className="flex flex-wrap gap-x-5 gap-y-1">
                              <span>
                                {t("worker.pay.reference")}{" "}
                                <span className="font-mono font-semibold">{p.proof.reference}</span>
                              </span>
                              <span>{t("worker.pay.amount", { amount: etb(p.proof.amountPaid) })}</span>
                              <span>{t("worker.pay.paidAt", { when: fmtDateTime(p.proof.paidAt) })}</span>
                              <span
                                className={`font-semibold ${
                                  p.proof.status === "verified"
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : p.proof.status === "rejected"
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                {t(`common.verification.${p.proof.status}`)}
                              </span>
                              {p.proof.reviewedAt && (
                                <span>{t("worker.pay.reviewedAt", { when: fmtDateTime(p.proof.reviewedAt) })}</span>
                              )}
                            </div>
                            {p.proof.status === "rejected" && p.proof.rejectionReason && (
                              <p className="mt-1 text-red-600 dark:text-red-400">{p.proof.rejectionReason}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{etb(p.amount)}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {data.accounts.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <Banknote className="h-4 w-4 text-primary" /> {t("worker.pay.customerPaysTo")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {data.accounts.map((a) => (
                    <p key={a._id}>
                      {a.bank} · <span className="font-medium">{a.accountName}</span> · {a.accountNumber}
                      {a.branch ? ` (${a.branch})` : ""}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* -------------------------------- TIMELINE ------------------------------- */}
          <TabsContent value="timeline" className="space-y-4">
            {(!booking.timeline || booking.timeline.length === 0) ? (
              <EmptyState
                icon={History}
                title={t("worker.timeline.emptyTitle")}
                hint={t("worker.timeline.emptyHint")}
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ol className="divide-y">
                    {[...booking.timeline].reverse().map((entry, i) => (
                      <li key={i} className="grid gap-1 p-4 sm:grid-cols-[150px_1fr]">
                        <span className="text-xs text-muted-foreground">{fmtDateTime(entry.at)}</span>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium">{prettyAction(entry.action)}</span>
                            {entry.from && entry.to && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                                {entry.from.replace(/_/g, " ")} → {entry.to.replace(/_/g, " ")}
                              </span>
                            )}
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                              {entry.actorRole || t("worker.timeline.system")}
                            </span>
                          </div>
                          {entry.note && <p className="text-sm text-muted-foreground">{entry.note}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* -------------------------------- MESSAGES ------------------------------- */}
          <TabsContent value="messages" className="space-y-4">
            {conversationId ? (
              <div className="h-[calc(100vh-20rem)] min-h-96">
                <ChatPanel conversationId={conversationId} otherName={customer?.name} />
              </div>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title={t("worker.jobDetail.noConversationTitle")}
                hint={t("worker.jobDetail.noConversationHint")}
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/worker/messages">{t("worker.jobDetail.openMessages")}</Link>
                  </Button>
                }
              />
            )}
          </TabsContent>
        </Tabs>

        {/* --------------------------------- DIALOGS -------------------------------- */}

        <RaiseDisputeDialog
          open={disputeOpen}
          onOpenChange={setDisputeOpen}
          bookingId={booking._id}
          bookingLabel={booking.code}
          categories={[...COMPLAINT_CATEGORIES]}
          onCreated={(disputeId) => router.push(`/dashboard/worker/disputes/${disputeId}`)}
        />

        <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("worker.jobDetail.updateProgressTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Label htmlFor="progress-range">{t("worker.jobs.progress")}</Label>
                  <span className="font-semibold">{progressPercent}%</span>
                </div>
                <input
                  id="progress-range"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progressPercent}
                  onChange={(e) => setProgressPercent(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="progress-note">{t("worker.jobDetail.noteOptional")}</Label>
                <Textarea
                  id="progress-note"
                  rows={3}
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder={t("worker.jobDetail.progressPlaceholder")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProgressOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={acting}
                onClick={() =>
                  void runStatus("IN_PROGRESS", {
                    progressPercent,
                    note: progressNote.trim() || undefined,
                  })
                }
              >
                {t("worker.jobDetail.saveUpdate")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("worker.jobDetail.markCompletedTitle")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">{t("worker.jobDetail.markCompletedDesc")}</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={acting} onClick={() => void runStatus("COMPLETED")}>
                <CircleCheckBig className="mr-1.5 h-4 w-4" /> {t("worker.jobDetail.markCompletedBtn")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={reasonOpen} onOpenChange={setReasonOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reasonStatus === "CANCELLED" ? t("worker.jobDetail.cancelTitle") : t("worker.jobDetail.problemTitle")}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="reason">
                {reasonStatus === "CANCELLED"
                  ? t("worker.jobDetail.cancelReasonLabel")
                  : t("worker.jobDetail.problemLabel")}{" "}
                *
              </Label>
              <Textarea
                id="reason"
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  reasonStatus === "CANCELLED"
                    ? t("worker.jobDetail.cancelReasonPlaceholder")
                    : t("worker.jobDetail.problemPlaceholder")
                }
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReasonOpen(false)}>
                {t("worker.jobDetail.keepJob")}
              </Button>
              <Button
                variant="destructive"
                disabled={acting || !reason.trim()}
                onClick={() => void runStatus(reasonStatus, { reason: reason.trim() })}
              >
                {reasonStatus === "CANCELLED" ? t("worker.jobDetail.cancelJobBtn") : t("worker.jobDetail.submitDispute")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addPhaseOpen} onOpenChange={setAddPhaseOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("worker.phase.addTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="phase-name">{t("worker.phase.nameLabel")}</Label>
                <Input id="phase-name" value={phaseName} onChange={(e) => setPhaseName(e.target.value)} placeholder={t("worker.phase.namePlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phase-desc">{t("common.description")}</Label>
                <Textarea id="phase-desc" rows={3} value={phaseDesc} onChange={(e) => setPhaseDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phase-amount">{t("worker.phase.amountLabel")}</Label>
                  <Input id="phase-amount" type="number" min={0} value={phaseAmount} onChange={(e) => setPhaseAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phase-due">{t("worker.phase.dueDateLabel")}</Label>
                  <Input id="phase-due" type="date" value={phaseDue} onChange={(e) => setPhaseDue(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPhaseOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={busyKey === "add-phase"} onClick={() => void addPhase()}>
                {busyKey === "add-phase" ? t("worker.phase.adding") : t("worker.phase.add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editPhase} onOpenChange={(open) => !open && setEditPhase(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("worker.phase.editTitle", { name: editPhase?.name || "" })}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-notes">{t("common.notes")}</Label>
                <Textarea id="edit-notes" rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-amount">{t("worker.phase.amountLabel")}</Label>
                <Input id="edit-amount" type="number" min={0} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <Label htmlFor="edit-percent">{t("worker.phase.percentComplete")}</Label>
                  <span className="font-semibold">{editPercent}%</span>
                </div>
                <input
                  id="edit-percent"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={editPercent}
                  onChange={(e) => setEditPercent(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditPhase(null)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={busyKey === `edit-${editPhase?._id}`} onClick={() => void saveEditPhase()}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={planOpen} onOpenChange={setPlanOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("worker.plan.configureTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("worker.plan.configureDesc", { amount: etb(summary.total) })}</p>
              <div className="space-y-2">
                {planRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={row.label}
                      onChange={(e) =>
                        setPlanRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)))
                      }
                      placeholder={t("worker.plan.labelPlaceholder")}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={row.percent}
                      onChange={(e) =>
                        setPlanRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, percent: n(e.target.value) } : r)))
                      }
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPlanRows((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={t("worker.plan.removeRow")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPlanRows((prev) => [...prev, { label: "", percent: 0 }])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> {t("worker.plan.addRow")}
                </Button>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    planSum === 100 ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300" : "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300"
                  }`}
                >
                  {planSum}% / 100%
                </span>
              </div>
              {planSum !== 100 && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{t("worker.plan.percent100")}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPlanOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button disabled={busyKey === "plan" || planSum !== 100} onClick={() => void savePlan()}>
                {busyKey === "plan" ? t("worker.plan.saving") : t("worker.plan.savePlan")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}

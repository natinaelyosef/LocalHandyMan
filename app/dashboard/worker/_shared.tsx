"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, CircleAlert, LoaderCircle, RotateCcw, ShieldAlert, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";

/* ---------------------------------- types --------------------------------- */

export type ScheduleSlot = { day: string; open: string; close: string; closed: boolean };

export type WorkerDocumentT = {
  _id: string;
  type: string;
  title: string;
  fileId?: string | null;
  status: string;
  reviewNote?: string;
  reviewedAt?: string | null;
};

export type PortfolioItemT = {
  _id: string;
  title: string;
  category?: string;
  description?: string;
  area?: string;
  completedAt?: string | null;
  beforeFileId?: string | null;
  duringFileId?: string | null;
  afterFileId?: string | null;
  status?: string;
};

export type WorkerProfileT = {
  _id: string;
  userId: string;
  profession: string;
  headline?: string;
  bio?: string;
  skills?: string[];
  yearsOfExperience?: number;
  languages?: string[];
  startingPrice?: number;
  priceNote?: string;
  categoryIds?: string[];
  serviceArea?: {
    region?: string;
    city?: string;
    woreda?: string;
    radiusKm?: number;
    latitude?: number | null;
    longitude?: number | null;
  };
  availability?: string;
  emergencyAvailable?: boolean;
  schedule?: ScheduleSlot[];
  status: string;
  statusNote?: string;
  verifiedAt?: string | null;
  documents?: WorkerDocumentT[];
  portfolio?: PortfolioItemT[];
  stats?: { jobsCompleted?: number; jobsCancelled?: number; ratingSum?: number; ratingCount?: number };
  responseTimeMinutes?: number;
};

export type CategoryT = {
  _id: string;
  name: string;
  icon?: string;
  parent?: string | null;
  children?: CategoryT[];
};

export type QuotationT = {
  _id: string;
  requestId: string;
  status: string;
  source?: string;
  total: number;
  laborCost: number;
  materialsCost?: number;
  transportCost?: number;
  otherCost?: number;
  estimatedDuration?: string;
  proposedStartDate?: string | null;
  proposedEndDate?: string | null;
  warrantyDays?: number;
  paymentPlan?: { label: string; percent: number }[];
  notes?: string;
  createdAt: string;
};

export type RequestItemT = {
  _id: string;
  reference: string;
  title: string;
  description: string;
  urgency: string;
  status: string;
  customerId: { _id: string; name: string; avatarFileId?: string | null; phone?: string };
  categoryId: { _id: string; name: string; icon?: string } | null;
  location: {
    label?: string;
    region?: string;
    city?: string;
    woreda?: string;
    subCity?: string;
    area?: string;
    street?: string;
    latitude?: number | null;
    longitude?: number | null;
    instructions?: string;
  };
  budget: number;
  quotationCount?: number;
  preferredDate?: string | null;
  preferredTime?: string;
  measurements?: string;
  requiredMaterials?: string;
  accessInstructions?: string;
  specialInstructions?: string;
  mediaFileIds?: string[];
  createdAt: string;
  preferredWorkerId?: string | null;
  myQuotation?: QuotationT | null;
};

export type BookingListItemT = {
  _id: string;
  code: string;
  title: string;
  status: string;
  agreedTotal: number;
  startDate?: string | null;
  expectedCompletion?: string | null;
  progressPercent: number;
  reviewed?: boolean;
  disputeOpen?: boolean;
  urgency?: string;
  createdAt: string;
  customerId: { _id: string; name: string; phone?: string; avatarFileId?: string | null };
  workerId?: unknown;
  location?: {
    label?: string;
    region?: string;
    city?: string;
    woreda?: string;
    area?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  paymentSummary?: { total: number; verified: number; pending: number; remaining: number };
  conversationId?: string | { _id: string } | null;
  warrantyDays?: number;
  expectedCompletionDate?: string | null;
};

export type JobPhaseT = {
  _id: string;
  order: number;
  name: string;
  description?: string;
  amount?: number;
  status: string;
  percent?: number;
  notes?: string;
  dueDate?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  evidence?: { before?: string[]; during?: string[]; after?: string[] };
};

export type PaymentProofT = {
  _id: string;
  reference: string;
  amountPaid: number;
  requiredAmount: number;
  status: string;
  paidAt: string;
  createdAt?: string;
  reviewedAt?: string | null;
  rejectionReason?: string;
  senderName?: string;
  bank?: string;
  note?: string;
  screenshotFileId?: string;
};

export type PaymentPhaseT = {
  _id: string;
  order: number;
  label: string;
  purpose?: string;
  amount: number;
  paidVerified?: number;
  status: string;
  dueDate?: string | null;
  paidAt?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string;
  paymentAccountId?: {
    bank?: string;
    accountName?: string;
    accountNumber?: string;
    branch?: string;
    instructions?: string;
  } | null;
  proof?: PaymentProofT | null;
  history?: { at: string; status: string; actorRole?: string; note?: string }[];
};

export type TimelineEntryT = {
  at: string;
  action: string;
  note?: string;
  from?: string;
  to?: string;
  actorRole?: string;
};

export type ConversationRefT = { _id: string; lastMessage?: string; lastMessageAt?: string | null };

/* --------------------------------- helpers -------------------------------- */

export function useErrMsg(): (err: unknown) => string {
  const { t } = useLocale();
  return useCallback(
    (err: unknown): string => {
      if (err instanceof Error && err.message) return err.message;
      return t("worker.error.generic");
    },
    [t]
  );
}

export function conversationIdOf(
  booking: { conversationId?: string | { _id: string } | null },
  conversation?: ConversationRefT | null
): string | null {
  if (conversation && conversation._id) return conversation._id;
  const c = booking.conversationId;
  if (!c) return null;
  return typeof c === "string" ? c : c._id;
}

export function avgRating(stats?: { ratingSum?: number; ratingCount?: number }): number {
  if (!stats || !stats.ratingCount) return 0;
  return Math.round(((stats.ratingSum || 0) / (stats.ratingCount || 1)) * 10) / 10;
}

export const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "worker.day.mon" },
  { key: "tue", label: "worker.day.tue" },
  { key: "wed", label: "worker.day.wed" },
  { key: "thu", label: "worker.day.thu" },
  { key: "fri", label: "worker.day.fri" },
  { key: "sat", label: "worker.day.sat" },
  { key: "sun", label: "worker.day.sun" },
];

export function defaultSchedule(): ScheduleSlot[] {
  return DAYS.map((d) => ({ day: d.key, open: "08:00", close: "17:00", closed: d.key === "sun" }));
}

export const DOC_TYPE_LABEL: Record<string, string> = {
  id: "worker.docType.id",
  skill_certificate: "worker.docType.skill_certificate",
  training_certificate: "worker.docType.training_certificate",
  experience_evidence: "worker.docType.experience_evidence",
  other: "worker.docType.other",
};

/* ------------------------- locally quoted requests ------------------------ */

const QUOTED_KEY = "hh_worker_quoted_requests";

export function readQuoted(): Record<string, { total: number; at: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(QUOTED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, { total: number; at: number }>) : {};
  } catch {
    return {};
  }
}

export function markQuoted(requestId: string, total: number): void {
  if (typeof window === "undefined") return;
  try {
    const all = readQuoted();
    all[requestId] = { total, at: Date.now() };
    window.localStorage.setItem(QUOTED_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/* -------------------------------- components ------------------------------ */

export function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize">
      {String(status || "").replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm">
        {body}
      </Link>
    );
  }
  return <div className="rounded-xl border bg-card p-4">{body}</div>;
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-3 font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-md text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useLocale();
  return (
    <Alert variant="destructive">
      <CircleAlert className="h-4 w-4" />
      <AlertTitle>{t("worker.error.pageLoad")}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {t("common.retry")}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

export function InlineSpinner({ label }: { label?: string }) {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="h-4 w-4 animate-spin" /> {label ?? t("common.loading")}
    </div>
  );
}

/* --------------------------- verification banner -------------------------- */

export function VerificationBanner({
  profile,
  onResubmitted,
  compact = false,
}: {
  profile: WorkerProfileT | null;
  onResubmitted?: (profile: WorkerProfileT) => void;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const { t } = useLocale();
  const errMsg = useErrMsg();
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  const status = profile.status;
  const note = profile.statusNote ? profile.statusNote : "";

  const resubmit = async () => {
    setBusy(true);
    try {
      const d = await api<{ profile: WorkerProfileT }>("/api/worker/profile", {
        method: "PATCH",
        body: { resubmit: true },
      });
      toast({ title: t("worker.verify.resubmitted"), description: t("worker.verify.resubmittedDesc") });
      onResubmitted?.(d.profile);
    } catch (err) {
      toast({ title: t("worker.verify.resubmitFailed"), description: errMsg(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (status === "approved") {
    return (
      <Alert className="border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 [&>svg]:text-emerald-600">
        <BadgeCheck className="h-4 w-4" />
        <AlertTitle>{t("worker.verify.approvedTitle")}</AlertTitle>
        <AlertDescription>{t("worker.verify.approvedDesc")}</AlertDescription>
      </Alert>
    );
  }

  if (status === "pending") {
    return (
      <Alert className="border-blue-300 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 [&>svg]:text-blue-600">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>{t("worker.verify.pendingTitle")}</AlertTitle>
        <AlertDescription>{t("worker.verify.pendingDesc")}</AlertDescription>
      </Alert>
    );
  }

  if (status === "resubmit_required" || status === "rejected") {
    return (
      <Alert className={status === "rejected" ? "border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200 [&>svg]:text-red-600" : "border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600"}>
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>
          {status === "rejected" ? t("worker.verify.rejectedTitle") : t("worker.verify.changesTitle")}
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{note || t("worker.verify.noteFallback")}</p>
          {!compact && (
            <Button size="sm" onClick={resubmit} disabled={busy}>
              {busy ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
              {t("worker.verify.fixResubmit")}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/60 text-red-900 dark:text-red-200 [&>svg]:text-red-600">
      <CircleAlert className="h-4 w-4" />
      <AlertTitle>{t("worker.verify.suspendedTitle")}</AlertTitle>
      <AlertDescription>{note || t("worker.verify.suspendedNote")}</AlertDescription>
    </Alert>
  );
}

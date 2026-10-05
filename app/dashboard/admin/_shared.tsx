"use client";

import type { ReactNode } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { statusClass } from "@/lib/client";
import { useLocale } from "@/context/locale";

/* ---------------------------------- types --------------------------------- */

export type CountsMap = Record<string, number>;

export interface AuditItem {
  _id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  meta: unknown;
  createdAt: string;
}

export interface AdminStats {
  totals: {
    totalCustomers: number;
    totalWorkers: number;
    pendingWorkers: number;
    verifiedWorkers: number;
    suspendedWorkers: number;
    activeBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    disputedBookings: number;
    openRequests: number;
    pendingProofs: number;
    verifiedProofs: number;
    rejectedProofs: number;
    totalReviews: number;
    openConversations: number;
    last30Users: number;
    quotationsTotal: number;
    verifiedAmount: number;
    pendingAmount: number;
    cancellationRate: number;
  };
  charts: {
    byCategory: { _id: string | null; name?: string; n: number }[];
    byStatus: { _id: string; n: number }[];
    monthly: { _id: { y: number; m: number }; n: number; completed: number }[];
    registrations: { _id: { y: number; m: number; role: string }; n: number }[];
    urgency: { _id: string | null; n: number }[];
  };
  recentAudit: AuditItem[];
}

/* --------------------------------- helpers -------------------------------- */

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function pretty(value?: string | null): string {
  if (!value) return "—";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/* --------------------------- enum label lookup ---------------------------- */

const STATUS_KEYS: Record<string, string> = {
  // booking statuses
  REQUESTED: "admin.bstatus.requested",
  QUOTATION_SENT: "admin.bstatus.quotationSent",
  QUOTATION_ACCEPTED: "admin.bstatus.quotationAccepted",
  BOOKING_CONFIRMED: "admin.bstatus.bookingConfirmed",
  ADVANCE_PAYMENT_DUE: "admin.bstatus.advancePaymentDue",
  PAYMENT_PROOF_SUBMITTED: "admin.bstatus.paymentProofSubmitted",
  PAYMENT_VERIFIED: "admin.bstatus.paymentVerified",
  SCHEDULED: "admin.bstatus.scheduled",
  WORKER_ON_THE_WAY: "admin.bstatus.workerOnTheWay",
  WORK_STARTED: "admin.bstatus.workStarted",
  IN_PROGRESS: "admin.bstatus.inProgress",
  AWAITING_CUSTOMER: "admin.bstatus.awaitingCustomer",
  READY_FOR_REVIEW: "admin.bstatus.readyForReview",
  COMPLETED: "admin.bstatus.completed",
  CUSTOMER_CONFIRMED: "admin.bstatus.customerConfirmed",
  CLOSED: "admin.bstatus.closed",
  CANCELLED: "admin.bstatus.cancelled",
  REJECTED: "admin.bstatus.rejected",
  DISPUTED: "admin.bstatus.disputed",
  EXPIRED: "admin.bstatus.expired",
  // payment phase statuses
  UNPAID: "admin.pstatus.unpaid",
  PAYMENT_DUE: "admin.pstatus.paymentDue",
  PROOF_SUBMITTED: "admin.pstatus.proofSubmitted",
  UNDER_VERIFICATION: "admin.pstatus.underVerification",
  VERIFIED: "admin.pstatus.verified",
  NOT_STARTED: "admin.jstatus.notStarted",
  // service request + lowercase booking-ish statuses
  open: "common.status.open",
  quoted: "common.status.quoted",
  booking_created: "admin.action.bookingCreated",
  cancelled: "common.status.cancelled",
  expired: "common.status.expired",
  booked: "common.status.booked",
  in_progress: "common.status.in_progress",
  completed: "common.status.completed",
  // urgency
  normal: "common.urgency.normal",
  urgent: "common.urgency.urgent",
  emergency: "common.urgency.emergency",
  // verification / proof / document statuses
  pending: "common.verification.pending",
  verified: "common.verification.verified",
  rejected: "common.verification.rejected",
  approved: "common.verification.verified",
  suspended: "admin.status.suspended",
  resubmit_required: "admin.status.resubmitRequired",
  // worker verification action results (admin-only, toast copy)
  approve: "admin.wstatus.approved",
  reject: "admin.wstatus.rejected",
  suspend: "admin.wstatus.suspended",
  reactivate: "admin.wstatus.reactivated",
  request_resubmit: "admin.wstatus.resubmissionRequested",
  feature: "admin.wstatus.featured",
  unfeature: "admin.wstatus.unfeatured",
  // account statuses
  active: "admin.status.active",
  disabled: "admin.status.disabled",
  // review moderation statuses
  visible: "admin.reviewStatus.visible",
  hidden: "admin.reviewStatus.hidden",
  removed: "admin.reviewStatus.removed",
  // roles
  customer: "admin.role.customer",
  worker: "admin.role.worker",
  admin: "admin.role.admin",
  // gender
  male: "admin.gender.male",
  female: "admin.gender.female",
  // availability
  available: "admin.availability.available",
  busy: "admin.availability.busy",
  away: "admin.availability.away",
  offline: "admin.availability.offline",
  // document types
  id: "admin.doctype.id",
  skill_certificate: "admin.doctype.skillCertificate",
  training_certificate: "admin.doctype.trainingCertificate",
  experience_evidence: "admin.doctype.experienceEvidence",
  other: "admin.other",
  // schedule days
  mon: "admin.day.mon",
  tue: "admin.day.tue",
  wed: "admin.day.wed",
  thu: "admin.day.thu",
  fri: "admin.day.fri",
  sat: "admin.day.sat",
  sun: "admin.day.sun",
  // quotation statuses
  accepted: "admin.qstatus.accepted",
  withdrawn: "admin.qstatus.withdrawn",
  changes_requested: "admin.qstatus.changesRequested",
  // audit + timeline actions
  login: "admin.action.login",
  logout: "admin.action.logout",
  register: "admin.action.register",
  booking_status_changed: "admin.action.bookingStatusChanged",
  worker_resubmitted: "admin.action.workerResubmitted",
  worker_document_uploaded: "admin.action.workerDocumentUploaded",
  worker_document_reviewed: "admin.action.workerDocumentReviewed",
  worker_approve: "admin.action.workerApprove",
  worker_reject: "admin.action.workerReject",
  worker_suspend: "admin.action.workerSuspend",
  worker_reactivate: "admin.action.workerReactivate",
  worker_request_resubmit: "admin.action.workerRequestResubmit",
  worker_feature: "admin.action.workerFeature",
  worker_unfeature: "admin.action.workerUnfeature",
  worker_review_document: "admin.action.workerReviewDocument",
  review_created: "admin.action.reviewCreated",
  review_moderated: "admin.action.reviewModerated",
  payment_plan_updated: "admin.action.paymentPlanUpdated",
  payment_proof_verified: "admin.action.paymentProofVerified",
  payment_proof_rejected: "admin.action.paymentProofRejected",
  payment_proof_submitted: "admin.action.paymentProofSubmitted",
  payment_account_created: "admin.action.paymentAccountCreated",
  payment_account_updated: "admin.action.paymentAccountUpdated",
  payment_account_deleted: "admin.action.paymentAccountDeleted",
  category_created: "admin.action.categoryCreated",
  category_updated: "admin.action.categoryUpdated",
  category_deleted: "admin.action.categoryDeleted",
  profile_updated: "admin.action.profileUpdated",
  password_changed: "admin.action.passwordChanged",
  admin_user_updated: "admin.action.adminUserUpdated",
  admin_user_deleted: "admin.action.adminUserDeleted",
  quotation_submitted: "admin.action.quotationSubmitted",
  quotation_accepted_intent: "admin.action.quotationAcceptedIntent",
  request_created: "admin.action.requestCreated",
  status_changed: "admin.action.statusChanged",
  job_phase_added: "admin.action.jobPhaseAdded",
  job_phase_updated: "admin.action.jobPhaseUpdated",
};

export function useStatusLabel() {
  const { t } = useLocale();
  return (raw?: string | null): string => {
    if (!raw) return "—";
    const key = STATUS_KEYS[raw];
    return key ? t(key) : pretty(raw);
  };
}

/* -------------------------------- components ------------------------------- */

export function StatusPill({ status, className }: { status?: string | null; className?: string }) {
  const label = useStatusLabel();
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(
        status || ""
      )} ${className || ""}`}
    >
      {label(status)}
    </span>
  );
}

export function ErrorAlert({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useLocale();
  return (
    <div className="space-y-2">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("common.error")}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  desc,
  icon: Icon = Inbox,
}: {
  title: string;
  desc?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
      <Icon className="mb-2 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {desc && <p className="mt-1 max-w-md text-sm text-muted-foreground">{desc}</p>}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/50 px-4 py-3">
        <Skeleton className="h-4 w-1/4" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  onPage,
  busy,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (p: number) => void;
  busy?: boolean;
}) {
  const { t } = useLocale();
  if (!total) return null;
  if (pages <= 1) {
    return (
      <p className="text-xs text-muted-foreground">
        {total === 1 ? t("admin.pagination.oneResult") : t("admin.pagination.results", { n: total })}
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
      <p className="text-sm text-muted-foreground">
        {t("admin.pagination.pageOf", { page, pages, total })}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="mr-1 h-4 w-4" /> {t("admin.pagination.prev")}
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages || busy} onClick={() => onPage(page + 1)}>
          {t("common.next")} <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function Field({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 break-words text-sm">{value === undefined || value === null || value === "" ? "—" : value}</div>
    </div>
  );
}

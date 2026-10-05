"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  ExternalLink,
  Eye,
  FileSearch,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, etb, fileUrl, fmtDate, fmtDateTime, timeAgo } from "@/lib/client";
import { REJECT_REASONS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { EmptyState, ErrorAlert, Field, ListSkeleton, Pagination, StatusPill, qs, useStatusLabel } from "../_shared";

type ProofHistoryEntry = {
  at: string;
  status: string;
  actorRole?: string;
  note?: string;
};

type ProofBooking = {
  _id: string;
  code: string;
  title: string;
  status: string;
  workerId?: { _id: string; name: string } | string;
} | null;

interface Proof {
  _id: string;
  reference: string;
  bookingId: string;
  paymentPhaseId: string;
  customerId: { _id: string; name: string; email: string; phone: string };
  amountPaid: number;
  requiredAmount: number;
  bank: string;
  senderName: string;
  senderAccount: string;
  receiverAccount: string;
  paidAt: string;
  note: string;
  screenshotFileId: string;
  status: "pending" | "verified" | "rejected";
  rejectionReason: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  duplicateFlag: boolean;
  underpaidBy: number;
  overpaidBy: number;
  history: ProofHistoryEntry[];
  createdAt: string;
  booking: ProofBooking;
  phase: { _id: string; label: string; amount: number; order: number } | null;
}

interface ProofsResp {
  items: Proof[];
  total: number;
  pages: number;
  counts: Record<string, number>;
  rejectReasons: string[];
}

const TABS = [
  { value: "pending", key: "common.verification.pending" },
  { value: "verified", key: "common.verification.verified" },
  { value: "rejected", key: "common.verification.rejected" },
  { value: "all", key: "common.all" },
] as const;

const TAB_EMPTY: Record<string, { titleKey: string; descKey: string }> = {
  pending: { titleKey: "admin.payments.emptyPendingTitle", descKey: "admin.payments.emptyPendingDesc" },
  verified: { titleKey: "admin.payments.emptyVerifiedTitle", descKey: "admin.payments.emptyVerifiedDesc" },
  rejected: { titleKey: "admin.payments.emptyRejectedTitle", descKey: "admin.payments.emptyRejectedDesc" },
  all: { titleKey: "admin.payments.emptyAllTitle", descKey: "admin.payments.emptyAllDesc" },
};

function AmountComparison({ proof, compact }: { proof: Proof; compact?: boolean }) {
  const { t } = useLocale();
  const diff = proof.amountPaid - proof.requiredAmount;
  return (
    <div className={`space-y-1 ${compact ? "" : "rounded-md border bg-muted/40 p-3"}`}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{t("admin.payments.required")}</span>
        <span className="font-medium">{etb(proof.requiredAmount)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{t("admin.payments.submitted")}</span>
        <span className={`font-semibold ${diff < 0 ? "text-red-600 dark:text-red-400" : diff > 0 ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {etb(proof.amountPaid)}
        </span>
      </div>
      {diff !== 0 && (
        <div className="flex justify-end">
          <Badge
            variant={diff < 0 ? "destructive" : "outline"}
            className={diff > 0 ? "border-transparent bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300" : ""}
          >
            {diff < 0 ? t("admin.payments.underpaid", { amount: etb(-diff) }) : t("admin.payments.overpaid", { amount: etb(diff) })}
          </Badge>
        </div>
      )}
      {diff === 0 && !compact && (
        <p className="pt-1 text-center text-xs text-emerald-600 dark:text-emerald-400">{t("admin.payments.amountsMatch")}</p>
      )}
    </div>
  );
}

function ProofCard({
  proof,
  onPreview,
  onVerify,
  onReject,
  busy,
}: {
  proof: Proof;
  onPreview: (p: Proof) => void;
  onVerify: (p: Proof) => void;
  onReject: (p: Proof) => void;
  busy: boolean;
}) {
  const { t } = useLocale();
  const bookingHref = `/dashboard/admin/bookings/${proof.booking?._id || proof.bookingId}`;
  const workerName =
    typeof proof.booking?.workerId === "object" ? proof.booking.workerId?.name : undefined;
  const tint =
    proof.status === "verified"
      ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/50"
      : proof.status === "rejected"
        ? "border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/40"
        : "";

  return (
    <Card className={tint}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-sm font-semibold">{proof.reference}</CardTitle>
            <StatusPill status={proof.status} />
            {proof.duplicateFlag && (
              <Badge className="border-transparent bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/70">
                <AlertTriangle className="mr-1 h-3 w-3" /> {t("admin.payments.possibleDuplicate")}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {proof.phase ? t("admin.payments.phaseLabel", { n: proof.phase.order, label: proof.phase.label }) : t("admin.payments.unknownPhase")}
            {proof.booking ? (
              <>
                {" · "}
                <Link href={bookingHref} className="font-medium text-primary underline-offset-2 hover:underline">
                  {proof.booking.code}
                </Link>
                {" · "}
                <span className="text-muted-foreground">{proof.booking.title}</span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onPreview(proof)}
          className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted"
          aria-label={t("admin.payments.viewScreenshot")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(proof.screenshotFileId)}
            alt={t("admin.payments.screenshotFor", { ref: proof.reference })}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 hidden items-center justify-center bg-black/50 text-white group-hover:flex">
            <Eye className="h-5 w-5" />
          </span>
        </button>
      </CardHeader>

      <CardContent className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("admin.payments.amountCheck")}</p>
          <AmountComparison proof={proof} />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("admin.payments.customerSender")}</p>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{proof.customerId?.name}</p>
            <p className="text-xs text-muted-foreground">
              {proof.customerId?.email} · {proof.customerId?.phone}
            </p>
            <div className="mt-2 space-y-0.5 text-xs">
              <p>
                <span className="text-muted-foreground">{t("admin.payments.sender")}:</span> {proof.senderName || "—"}
                {proof.senderAccount ? ` · ${proof.senderAccount}` : ""}
              </p>
              <p>
                <span className="text-muted-foreground">{t("admin.payments.receiver")}:</span> {proof.receiverAccount || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">{t("admin.payments.bank")}:</span> {proof.bank || "CBE"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("admin.payments.details")}</p>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">{t("admin.payments.paidOn")}:</span> {fmtDate(proof.paidAt)}
            </p>
            <p>
              <span className="text-muted-foreground">{t("admin.payments.submittedLabel")}:</span> {timeAgo(proof.createdAt)}
            </p>
            {workerName && (
              <p>
                <span className="text-muted-foreground">{t("admin.bdetail.worker")}:</span> {workerName}
              </p>
            )}
            {proof.note && (
              <p className="text-xs italic text-muted-foreground">“{proof.note}”</p>
            )}
            {proof.status === "verified" && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                {t("admin.payments.platformRecord", { date: proof.reviewedAt ? fmtDateTime(proof.reviewedAt) : "—" })}
              </p>
            )}
            {proof.status === "rejected" && (
              <p className="text-xs text-red-700 dark:text-red-300">{t("common.reason")}: {proof.rejectionReason || "—"}</p>
            )}
            {proof.status !== "pending" && proof.history.length > 0 && (
              <p className="text-xs text-muted-foreground">{t("admin.payments.historyCount", { n: proof.history.length })}</p>
            )}
          </div>
        </div>
      </CardContent>

      <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button asChild variant="outline" size="sm">
          <Link href={bookingHref}>
            {t("admin.payments.openBooking")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
        {proof.status === "pending" ? (
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => onVerify(proof)}>
              <BadgeCheck className="mr-1.5 h-4 w-4" /> {t("admin.verify")}
            </Button>
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => onReject(proof)}>
              <XCircle className="mr-1.5 h-4 w-4" /> {t("admin.reject")}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onPreview(proof)}>
            <Eye className="mr-1.5 h-4 w-4" /> {t("admin.payments.viewSubmission")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminPaymentsPage() {
  const { toast } = useToast();
  const { t } = useLocale();
  const label = useStatusLabel();
  const [tab, setTab] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ProofsResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [preview, setPreview] = useState<Proof | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<Proof | null>(null);
  const [verifyNote, setVerifyNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Proof | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    setTab(s && TABS.some((tb) => tb.value === s) ? s : "pending");
  }, []);

  useEffect(() => {
    if (tab === null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api<ProofsResp>(`/api/payments/proofs${qs({ status: tab, q, page, limit: 10 })}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t("admin.errors.loadProofs"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, q]);

  const reload = () => {
    setLoading(true);
    setError("");
    api<ProofsResp>(`/api/payments/proofs${qs({ status: tab || "pending", q, page, limit: 10 })}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("admin.errors.loadProofs")))
      .finally(() => setLoading(false));
  };

  const submitAction = async (proof: Proof, body: Record<string, unknown>, successTitle: string) => {
    setBusyId(proof._id);
    setActionError("");
    try {
      await api(`/api/payments/proofs/${proof._id}`, { body });
      toast({ title: successTitle, description: `${proof.reference} · ${etb(proof.amountPaid)}` });
      setVerifyTarget(null);
      setRejectTarget(null);
      setVerifyNote("");
      setRejectReason("");
      setRejectNote("");
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.actionFailed");
      setActionError(msg);
      toast({ title: t("admin.errors.actionFailed"), description: msg, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  };

  const counts = data?.counts || {};
  const rejectReasons = data?.rejectReasons?.length ? data.rejectReasons : [...REJECT_REASONS];
  const empty = TAB_EMPTY[tab || "pending"];

  return (
    <DashboardShell
      role="admin"
      nav={ADMIN_NAV}
      title={t("nav.paymentVerification")}
      subtitle={t("admin.payments.subtitle")}
    >
      <div className="max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={tab || "pending"}
            onValueChange={(v) => {
              setTab(v);
              setPage(1);
            }}
          >
            <TabsList>
              {TABS.map((tb) => (
                <TabsTrigger key={tb.value} value={tb.value} className="gap-2">
                  {t(tb.key)}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                      tb.value === "pending" && (counts.pending || 0) > 0
                        ? "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {counts[tb.value] || 0}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <form onSubmit={onSearch} className="flex gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("admin.payments.searchPlaceholder")}
              className="w-full lg:w-72"
            />
            <Button type="submit" variant="outline">
              <Search className="mr-1.5 h-4 w-4" /> {t("common.search")}
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={reload} aria-label={t("common.refresh")}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {error && <ErrorAlert error={error} onRetry={reload} />}

        {loading && !data ? (
          <ListSkeleton rows={5} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title={q ? t("admin.payments.emptySearchTitle") : t(empty.titleKey)}
            desc={q ? t("admin.payments.emptySearchDesc", { q }) : t(empty.descKey)}
          />
        ) : (
          <div className="space-y-4">
            {data.items.map((p) => (
              <ProofCard
                key={p._id}
                proof={p}
                busy={busyId === p._id}
                onPreview={setPreview}
                onVerify={(proof) => {
                  setActionError("");
                  setVerifyNote("");
                  setVerifyTarget(proof);
                }}
                onReject={(proof) => {
                  setActionError("");
                  setRejectReason("");
                  setRejectNote("");
                  setRejectTarget(proof);
                }}
              />
            ))}
            <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} busy={loading} />
          </div>
        )}

        {/* preview dialog */}
        <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            {preview && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex flex-wrap items-center gap-2">
                    {preview.reference} <StatusPill status={preview.status} />
                  </DialogTitle>
                  <DialogDescription>
                    {t("admin.payments.submittedBy", { time: timeAgo(preview.createdAt), name: preview.customerId?.name })}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-3">
                    <a href={fileUrl(preview.screenshotFileId)} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fileUrl(preview.screenshotFileId)}
                        alt={t("admin.payments.paymentScreenshot")}
                        loading="lazy"
                        decoding="async"
                        className="max-h-80 w-full rounded-md border object-contain bg-muted"
                      />
                    </a>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ExternalLink className="h-3 w-3" /> {t("admin.payments.opensFullSize")}
                    </p>
                    <AmountComparison proof={preview} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("admin.payments.reference")} value={preview.reference} />
                    <Field label={t("common.status")} value={<StatusPill status={preview.status} />} />
                    <Field label={t("admin.bdetail.phase")} value={preview.phase ? `${preview.phase.order}. ${preview.phase.label}` : "—"} />
                    <Field label={t("admin.payments.paidOn")} value={fmtDate(preview.paidAt)} />
                    <Field label={t("admin.bdetail.customer")} value={preview.customerId?.name} />
                    <Field label={t("common.phone")} value={preview.customerId?.phone} />
                    <Field label={t("common.email")} value={preview.customerId?.email} className="col-span-2" />
                    <Field label={t("admin.payments.sender")} value={preview.senderName} />
                    <Field label={t("admin.payments.senderAccount")} value={preview.senderAccount} />
                    <Field label={t("admin.payments.receiverAccount")} value={preview.receiverAccount} />
                    <Field label={t("admin.payments.bank")} value={preview.bank || "CBE"} />
                    <Field label={t("common.note")} value={preview.note} className="col-span-2" />
                    <Field
                      label={t("nav.bookings")}
                      value={
                        preview.booking ? (
                          <Link
                            href={`/dashboard/admin/bookings/${preview.booking._id}`}
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {preview.booking.code} · {preview.booking.title}
                          </Link>
                        ) : (
                          "—"
                        )
                      }
                      className="col-span-2"
                    />
                    {preview.status !== "pending" && (
                      <Field
                        label={t("admin.payments.reviewedAt")}
                        value={preview.reviewedAt ? fmtDateTime(preview.reviewedAt) : "—"}
                        className="col-span-2"
                      />
                    )}
                    {preview.status === "rejected" && (
                      <Field label={t("admin.bdetail.rejectionReason")} value={preview.rejectionReason} className="col-span-2" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("admin.payments.history")}
                  </p>
                  {preview.history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("admin.payments.noHistory")}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {preview.history.map((h, i) => (
                        <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs">
                          <span className="font-medium">{label(h.status)}</span>
                          <span className="text-muted-foreground">{h.actorRole || t("admin.actor.system")}</span>
                          <span className="ml-auto text-muted-foreground">{fmtDateTime(h.at)}</span>
                          {h.note && <span className="w-full text-muted-foreground">{h.note}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setPreview(null)}>
                    {t("common.close")}
                  </Button>
                  {preview.status === "pending" && (
                    <>
                      <Button
                        variant="destructive"
                        disabled={busyId === preview._id}
                        onClick={() => {
                          setRejectTarget(preview);
                          setPreview(null);
                          setActionError("");
                          setRejectReason("");
                          setRejectNote("");
                        }}
                      >
                        {t("admin.reject")}
                      </Button>
                      <Button
                        disabled={busyId === preview._id}
                        onClick={() => {
                          setVerifyTarget(preview);
                          setPreview(null);
                          setActionError("");
                          setVerifyNote("");
                        }}
                      >
                        {t("admin.verify")}
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* verify dialog */}
        <Dialog open={!!verifyTarget} onOpenChange={(o) => !o && setVerifyTarget(null)}>
          <DialogContent>
            {verifyTarget && (
              <>
                <DialogHeader>
                  <DialogTitle>{t("admin.payments.verifyTitle")}</DialogTitle>
                  <DialogDescription>{t("admin.payments.verifyDesc")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <AmountComparison proof={verifyTarget} />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">{t("admin.payments.reference")}</p>
                      <p className="font-medium">{verifyTarget.reference}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t("admin.bdetail.phase")}</p>
                      <p className="font-medium">{verifyTarget.phase?.label || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">{t("nav.bookings")}</p>
                      <p className="font-medium">
                        {verifyTarget.booking?.code} · {verifyTarget.booking?.title}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="verify-note">{t("admin.note.optional")}</Label>
                    <Textarea
                      id="verify-note"
                      value={verifyNote}
                      onChange={(e) => setVerifyNote(e.target.value)}
                      placeholder={t("admin.payments.verifyNotePlaceholder")}
                      rows={2}
                    />
                  </div>
                  {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setVerifyTarget(null)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    disabled={busyId === verifyTarget._id}
                    onClick={() =>
                      submitAction(
                        verifyTarget,
                        { action: "verify", note: verifyNote },
                        t("admin.bdetail.proofVerified")
                      )
                    }
                  >
                    {busyId === verifyTarget._id ? t("admin.payments.verifying") : t("admin.confirmVerify")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* reject dialog */}
        <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
          <DialogContent>
            {rejectTarget && (
              <>
                <DialogHeader>
                  <DialogTitle>{t("admin.payments.rejectTitle")}</DialogTitle>
                  <DialogDescription>{t("admin.payments.rejectDesc")}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <AmountComparison proof={rejectTarget} />
                  <div className="space-y-1.5">
                    <Label htmlFor="reject-reason">{t("common.reason")}</Label>
                    <Select value={rejectReason} onValueChange={setRejectReason}>
                      <SelectTrigger id="reject-reason">
                        <SelectValue placeholder={t("admin.selectReason")} />
                      </SelectTrigger>
                      <SelectContent>
                        {rejectReasons.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reject-note">{t("admin.note.optional")}</Label>
                    <Textarea
                      id="reject-note"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      placeholder={t("admin.payments.rejectNotePlaceholder")}
                      rows={2}
                    />
                  </div>
                  {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRejectTarget(null)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busyId === rejectTarget._id || !rejectReason}
                    onClick={() =>
                      submitAction(
                        rejectTarget,
                        { action: "reject", reason: rejectReason, note: rejectNote },
                        t("admin.bdetail.proofRejected")
                      )
                    }
                  >
                    {busyId === rejectTarget._id ? t("admin.payments.rejecting") : t("admin.confirmReject")}
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

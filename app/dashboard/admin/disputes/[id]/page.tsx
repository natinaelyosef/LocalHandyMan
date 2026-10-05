"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Gavel,
  Loader2,
  Lock,
  RefreshCw,
  Scale,
  UserCheck,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import {
  DisputePriorityBadge,
  DisputeStatusBadge,
  DisputeSummaryGrid,
  DisputeThread,
  DisputeTimelineList,
  EvidenceGrid,
  useDisputeLabels,
  usePriorityLabel,
  type DisputeDetailResp,
} from "@/components/dashboard/disputes-ui";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { ErrorAlert, ListSkeleton, StatusPill } from "../../_shared";

export default function AdminDisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const { t } = useLocale();
  const { toast } = useToast();
  const statusLabel = useDisputeLabels();
  const priorityLabel = usePriorityLabel();

  const [data, setData] = useState<DisputeDetailResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const [statusOpen, setStatusOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");

  const [resolveOpen, setResolveOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [targetPriority, setTargetPriority] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setData(await api<DisputeDetailResp>(`/api/disputes/${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (body: Record<string, unknown>, successTitle: string) => {
    setBusy(true);
    setActionError("");
    try {
      await api(`/api/disputes/${id}`, { method: "PATCH", body });
      toast({ title: successTitle, description: data?.dispute.code });
      setStatusOpen(false);
      setResolveOpen(false);
      setPriorityOpen(false);
      setStatusNote("");
      setOutcome("");
      setRefundAmount("");
      setResolutionNotes("");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("common.error");
      setActionError(msg);
      toast({ title: t("common.error"), description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell
      role="admin"
      nav={ADMIN_NAV}
      title={data?.dispute.code || t("common.dispute.detail")}
      subtitle={data?.dispute.subject}
    >
      <div className="max-w-5xl space-y-6">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/admin/disputes">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("common.back")}
          </Link>
        </Button>

        {error ? (
          <ErrorAlert error={error} onRetry={load} />
        ) : loading && !data ? (
          <ListSkeleton rows={4} />
        ) : data ? (
          <>
            {/* actions bar */}
            <div className="flex flex-wrap items-center gap-2">
              <DisputeStatusBadge status={data.dispute.status} />
              <DisputePriorityBadge priority={data.dispute.priority} />
              <Button
                variant="ghost"
                size="icon"
                onClick={load}
                aria-label={t("common.refresh")}
                className="ml-auto"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => runAction({ action: "assign", assignedToId: "me" }, t("admin.disputes.assigned"))}
              >
                <UserCheck className="mr-1.5 h-3.5 w-3.5" /> {t("admin.disputes.assignToMe")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTargetPriority(data.dispute.priority);
                  setPriorityOpen(true);
                }}
              >
                {t("admin.disputes.priorityLabel")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTargetStatus("");
                  setStatusNote("");
                  setStatusOpen(true);
                }}
              >
                {t("admin.disputes.setStatus")}
              </Button>
              <Button size="sm" onClick={() => setResolveOpen(true)}>
                <Gavel className="mr-1.5 h-3.5 w-3.5" /> {t("common.dispute.resolve")}
              </Button>
              {data.dispute.status === "closed" ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => runAction({ action: "status", status: "under_review" }, t("admin.disputes.reopened"))}
                >
                  {t("common.dispute.reopen")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !["resolved", "rejected"].includes(data.dispute.status)}
                  onClick={() => runAction({ action: "close" }, t("admin.disputes.closed"))}
                >
                  {t("common.dispute.close")}
                </Button>
              )}
            </div>

            {data.dispute.assignedTo && (
              <p className="text-xs text-muted-foreground">
                {t("admin.disputes.assignedTo")}: {(data.dispute.assignedTo as { name?: string }).name}
              </p>
            )}

            {/* parties */}
            <div className="grid gap-4 sm:grid-cols-2">
              {[data.dispute.raisedBy, data.dispute.againstUserId].map((p, i) => (
                <Card key={p._id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {i === 0 ? t("admin.disputes.raisedBy") : t("admin.disputes.against")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0.5 text-sm">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.phone}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* case detail */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Scale className="h-4 w-4" /> {t("common.dispute.detail")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <DisputeSummaryGrid dispute={data.dispute} />

                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("common.dispute.description")}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{data.dispute.description}</p>
                </div>

                {data.dispute.evidenceFileIds && data.dispute.evidenceFileIds.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("common.dispute.evidence")} ({data.dispute.evidenceFileIds.length})
                    </p>
                    <EvidenceGrid ids={data.dispute.evidenceFileIds} />
                  </div>
                )}

                {data.dispute.resolution && data.dispute.resolution.outcome && (
                  <div className="space-y-1.5 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                      {t("common.dispute.resolution")}
                    </p>
                    <p className="text-sm font-medium">
                      {t(`common.dispute.outcome.${data.dispute.resolution.outcome}`)}
                    </p>
                    {!!data.dispute.resolution.refundAmount && (
                      <p className="text-sm">
                        {t("common.dispute.refundAmount")}: {data.dispute.resolution.refundAmount} ETB
                      </p>
                    )}
                    {data.dispute.resolution.notes && (
                      <p className="text-sm">{data.dispute.resolution.notes}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* conversation + internal notes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Lock className="h-4 w-4" /> {t("admin.disputes.investigation")}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t("admin.disputes.investigationHint")}</p>
              </CardHeader>
              <CardContent>
                <DisputeThread
                  disputeId={data.dispute._id}
                  initialMessages={data.messages}
                  viewerId={data.viewer.id}
                  viewerRole={data.viewer.role}
                  locked={false}
                  onSent={load}
                />
              </CardContent>
            </Card>

            {/* case timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t("common.dispute.timeline")}</CardTitle>
              </CardHeader>
              <CardContent>
                <DisputeTimelineList entries={data.dispute.timeline || []} />
              </CardContent>
            </Card>

            {data.siblings.length > 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">{t("common.dispute.timeline")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.siblings.map((s) => (
                    <div key={s._id} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                      <StatusPill status={s.status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>

      {/* status dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.disputes.setStatus")}</DialogTitle>
            <DialogDescription>
              {t("common.dispute.status.under_review")} → {statusLabel(targetStatus)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ds-status">{t("common.status")}</Label>
              <Select value={targetStatus} onValueChange={setTargetStatus}>
                <SelectTrigger id="ds-status">
                  <SelectValue placeholder={t("common.status")} />
                </SelectTrigger>
                <SelectContent>
                  {data?.allowedTransitions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds-status-note">{t("admin.note.optional")}</Label>
              <Textarea
                id="ds-status-note"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={3}
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
            <Button
              disabled={busy || !targetStatus}
              onClick={() =>
                runAction(
                  { action: "status", status: targetStatus, note: statusNote },
                  t("admin.disputes.statusUpdated")
                )
              }
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* resolve dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.dispute.resolve")}</DialogTitle>
            <DialogDescription>{t("common.dispute.resolveDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ds-outcome">{t("common.dispute.resolution")}</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger id="ds-outcome">
                  <SelectValue placeholder={t("common.dispute.resolve")} />
                </SelectTrigger>
                <SelectContent>
                  {(data?.outcomes || []).map((o) => (
                    <SelectItem key={o} value={o}>
                      {t(`common.dispute.outcome.${o}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds-refund">{t("common.dispute.refundAmount")} (ETB)</Label>
              <Input
                id="ds-refund"
                type="number"
                min={0}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ds-res-notes">{t("common.dispute.resolutionNotes")}</Label>
              <Textarea
                id="ds-res-notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
              />
            </div>
            {actionError && (
              <Alert variant="destructive">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={busy || !outcome}
              onClick={() =>
                runAction(
                  {
                    action: "resolve",
                    outcome,
                    refundAmount: Number(refundAmount || 0),
                    resolutionNotes,
                  },
                  t("admin.bdetail.statusUpdated")
                )
              }
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.dispute.resolve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* priority dialog */}
      <Dialog open={priorityOpen} onOpenChange={setPriorityOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("admin.disputes.priorityLabel")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Select value={targetPriority} onValueChange={setTargetPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(data?.priorities || []).map((p) => (
                  <SelectItem key={p} value={p}>
                    {priorityLabel(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {actionError && (
            <Alert variant="destructive">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPriorityOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              disabled={busy || !targetPriority}
              onClick={() =>
                runAction(
                  { action: "priority", priority: targetPriority },
                  t("admin.disputes.priorityUpdated")
                )
              }
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

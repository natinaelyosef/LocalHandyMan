"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, MessageSquare, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
import { api, etb, fileUrl, fmtDate } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import type { BookingDetail, JobPhase } from "@/app/dashboard/customer/_lib/types";
import { EmptyState, FieldError, StatusBadge, errText } from "@/app/dashboard/customer/_lib/ui";

const EVIDENCE: { key: "before" | "during" | "after"; labelKey: string }[] = [
  { key: "before", labelKey: "customer.phases.before" },
  { key: "during", labelKey: "customer.phases.during" },
  { key: "after", labelKey: "customer.phases.after" },
];

export function PhasesTab({ data, reload }: { data: BookingDetail; reload: () => void }) {
  const { toast } = useToast();
  const { t } = useLocale();
  const phases = data.jobPhases || [];
  const [rejectFor, setRejectFor] = useState<JobPhase | null>(null);
  const [note, setNote] = useState("");
  const [noteErr, setNoteErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const review = async (phaseId: string, approve: boolean, text = "") => {
    try {
      await api("/api/job-phases/review", { body: { phaseId, approve, note: text } });
      toast({
        title: approve ? t("customer.phases.approvedTitle") : t("customer.phases.changesRequestedTitle"),
        description: approve ? t("customer.phases.approvedDesc") : t("customer.phases.changesRequestedDesc"),
      });
      reload();
    } catch (e) {
      toast({ title: t("customer.phases.reviewFailed"), description: errText(e, t), variant: "destructive" });
      throw e;
    }
  };

  const approve = async (p: JobPhase) => {
    setApproving(p._id);
    try {
      await review(p._id, true);
    } catch {
      /* toasted */
    } finally {
      setApproving(null);
    }
  };

  const sendReject = async () => {
    if (!rejectFor) return;
    if (note.trim().length < 3) {
      setNoteErr(t("customer.phases.noteError"));
      return;
    }
    setBusy(true);
    try {
      await review(rejectFor._id, false, note.trim());
      setRejectFor(null);
      setNote("");
    } catch {
      /* toasted */
    } finally {
      setBusy(false);
    }
  };

  if (!phases.length) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t("customer.phases.emptyTitle")}
        message={t("customer.phases.emptyMsg")}
      />
    );
  }

  return (
    <>
      <div className="space-y-4">
        {phases.map((p) => {
          const needsReview = p.status === "AWAITING_CUSTOMER" || p.status === "COMPLETED";
          const evidence = p.evidence || {};
          return (
            <div key={p._id} className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-3">
                <Badge variant="secondary" className="mt-0.5">
                  #{p.order}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{p.name}</h3>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                </div>
                {p.amount ? <span className="text-sm font-semibold">{etb(p.amount)}</span> : null}
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("customer.phases.progress")}</span>
                  <span>{p.percent || 0}%</span>
                </div>
                <Progress value={p.percent || 0} className="h-2" />
              </div>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                {p.startedAt && <span>{t("customer.phases.started", { date: fmtDate(p.startedAt) })}</span>}
                {p.dueDate && <span>{t("customer.phases.due", { date: fmtDate(p.dueDate) })}</span>}
                {p.completedAt && <span>{t("customer.phases.completed", { date: fmtDate(p.completedAt) })}</span>}
                {p.status === "NOT_STARTED" && <span>{t("customer.phases.notStartedYet")}</span>}
              </div>

              {p.notes && (
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                  {p.notes}
                </p>
              )}

              <div className="mt-4 space-y-3 border-t pt-4">
                {EVIDENCE.map((e) => {
                  const files = (evidence[e.key] || []) as string[];
                  if (!files.length) return null;
                  return (
                    <div key={e.key}>
                      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <Wrench className="h-3.5 w-3.5" />{" "}
                        {t("customer.phases.evidencePhotos", { phase: t(e.labelKey) })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {files.map((f) => (
                          <a
                            key={f}
                            href={fileUrl(f)}
                            target="_blank"
                            rel="noreferrer"
                            className="block h-20 w-20 overflow-hidden rounded-lg border"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={fileUrl(f)}
                              alt={t("customer.phases.evidenceAlt", { phase: t(e.labelKey) })}
                              className="h-full w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!filesExist(p) && (
                  <p className="text-xs text-muted-foreground">{t("customer.phases.noPhotos")}</p>
                )}
              </div>

              {needsReview && (
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <Button size="sm" onClick={() => approve(p)} disabled={approving === p._id}>
                    {approving === p._id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    {t("customer.phases.approvePhase")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejectFor(p);
                      setNote("");
                      setNoteErr("");
                    }}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" /> {t("customer.phases.requestChanges")}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("customer.phases.changesDialogTitle", { name: rejectFor?.name || "" })}</DialogTitle>
            <DialogDescription>{t("customer.phases.changesDialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="phase-note">{t("customer.phases.changesLabel")} *</Label>
            <Textarea
              id="phase-note"
              rows={4}
              placeholder={t("customer.phases.changesPlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <FieldError msg={noteErr} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={sendReject} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("customer.phases.sendRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function filesExist(p: JobPhase): boolean {
  const e = p.evidence || {};
  return !!((e.before || []).length || (e.during || []).length || (e.after || []).length);
}

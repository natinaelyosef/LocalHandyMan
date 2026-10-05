"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  Loader2,
  Lock,
  Paperclip,
  Scale,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, fileUrl, fmtDateTime, timeAgo } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";

/* ---------------------------------- types --------------------------------- */

export type DisputeParty = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  avatarFileId?: string | null;
  role?: string;
};

export type DisputeMessage = {
  at: string;
  authorId?: string | null;
  authorRole: string;
  body: string;
  fileIds?: string[];
  internal?: boolean;
};

export type DisputeTimelineEntry = {
  at: string;
  action: string;
  note?: string;
  from?: string;
  to?: string;
  actorRole?: string;
};

export type DisputeT = {
  _id: string;
  code: string;
  bookingId: string | { _id: string; code: string; title: string; status: string; agreedTotal: number };
  raisedBy: DisputeParty;
  againstUserId: DisputeParty;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  evidenceFileIds?: string[];
  assignedTo?: ({ _id: string; name: string } & Record<string, unknown>) | null;
  resolution?: {
    outcome?: string;
    refundAmount?: number;
    notes?: string;
    resolvedAt?: string | null;
  };
  firstResponseAt?: string | null;
  lastMessageAt?: string | null;
  closedAt?: string | null;
  timeline?: DisputeTimelineEntry[];
  createdAt: string;
  updatedAt?: string;
};

export type DisputeDetailResp = {
  dispute: DisputeT;
  messages: DisputeMessage[];
  siblings: { _id: string; code: string; status: string; createdAt: string }[];
  viewer: { role: string; id: string; isAdmin: boolean; isParty: boolean };
  allowedTransitions: string[];
  outcomes: string[];
  priorities: string[];
};

/* --------------------------------- helpers -------------------------------- */

export function useDisputeLabels() {
  const { t } = useLocale();
  return useCallback(
    (status?: string | null) => {
      if (!status) return "—";
      const key = `common.dispute.status.${status}`;
      const out = t(key);
      return out === key ? status : out;
    },
    [t]
  );
}

export function usePriorityLabel() {
  const { t } = useLocale();
  return useCallback(
    (priority?: string | null) => {
      if (!priority) return "—";
      const key = `common.dispute.priority.${priority}`;
      const out = t(key);
      return out === key ? priority : out;
    },
    [t]
  );
}

const PRIORITY_STYLE: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  under_review: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  awaiting_response: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  closed: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function DisputeStatusBadge({ status }: { status: string }) {
  const label = useDisputeLabels();
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_STYLE[status] || STATUS_STYLE.open
      }`}
    >
      {label(status)}
    </span>
  );
}

export function DisputePriorityBadge({ priority }: { priority?: string | null }) {
  const label = usePriorityLabel();
  if (!priority || priority === "normal") return null;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
        PRIORITY_STYLE[priority] || PRIORITY_STYLE.normal
      }`}
    >
      <AlertTriangle className="h-3 w-3" />
      {label(priority)}
    </span>
  );
}

export function EvidenceGrid({ ids, columns = 4 }: { ids?: string[]; columns?: number }) {
  const { t } = useLocale();
  if (!ids || ids.length === 0) return null;
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {ids.map((id) => (
        <a
          key={id}
          href={fileUrl(id)}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-md border bg-muted"
          aria-label={t("common.dispute.attachedFiles")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl(id)} alt="" loading="lazy" decoding="async" className="h-24 w-full object-cover" />
        </a>
      ))}
    </div>
  );
}

/* ------------------------------- raise dialog ----------------------------- */

export function RaiseDisputeDialog({
  open,
  onOpenChange,
  bookingId,
  bookingLabel,
  categories,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId: string;
  bookingLabel?: string;
  categories: string[];
  onCreated: (disputeId: string) => void;
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setCategory("");
      setSubject("");
      setDescription("");
      setFiles([]);
      setError("");
    }
  }, [open]);

  const submit = async () => {
    if (!bookingId) {
      setError(t("common.dispute.selectBookingFirst"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("bookingId", bookingId);
      form.append("category", category);
      form.append("subject", subject);
      form.append("description", description);
      for (const f of files) form.append("evidence", f);
      const d = await api<{ dispute: { _id: string } }>("/api/disputes", { method: "POST", form });
      toast({ title: t("common.dispute.submitted"), description: t("common.dispute.submittedDesc") });
      onCreated(d.dispute._id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" /> {t("common.dispute.raiseTitle")}
          </DialogTitle>
          <DialogDescription>
            {bookingLabel ? `${t("common.dispute.onBooking", { code: bookingLabel })} — ` : ""}
            {t("common.dispute.raiseDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ds-category">{t("common.dispute.category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="ds-category">
                <SelectValue placeholder={t("common.dispute.selectCategory")} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ds-subject">{t("common.dispute.subject")}</Label>
            <input
              id="ds-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("common.dispute.subjectPlaceholder")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              maxLength={160}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ds-description">{t("common.dispute.description")}</Label>
            <Textarea
              id="ds-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("common.dispute.descriptionPlaceholder")}
              rows={5}
              maxLength={4000}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ds-evidence">{t("common.dispute.evidence")}</Label>
            <input
              ref={fileRef}
              id="ds-evidence"
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Paperclip className="mr-1.5 h-3.5 w-3.5" /> {t("chat.attachFile")}
              </Button>
              {files.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    aria-label={t("common.dispute.removeFile")}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("common.dispute.evidenceOptional")}</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || !category || subject.trim().length < 5}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {busy ? t("common.dispute.submitting") : t("common.dispute.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- thread --------------------------------- */

export function DisputeThread({
  disputeId,
  initialMessages,
  viewerId,
  viewerRole,
  locked,
  onSent,
}: {
  disputeId: string;
  initialMessages: DisputeMessage[];
  viewerId: string;
  viewerRole: string;
  locked?: boolean;
  onSent?: () => void;
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const [messages, setMessages] = useState<DisputeMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isAdmin = viewerRole === "admin";

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("body", body);
      if (isAdmin) form.append("internal", String(internal));
      for (const f of files) form.append("evidence", f);
      await api(`/api/disputes/${disputeId}/messages`, { method: "POST", form });
      setBody("");
      setFiles([]);
      setInternal(false);
      const d = await api<{ messages: DisputeMessage[] }>(`/api/disputes/${disputeId}/messages`);
      setMessages(d.messages);
      toast({
        title: internal ? t("common.dispute.noteSaved") : t("common.dispute.msgSent"),
      });
      onSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("common.dispute.noMessages")}
        </p>
      ) : (
        <ul className="space-y-3">
          {messages.map((m, i) => {
            const mine = m.authorId?.toString() === viewerId;
            const isSupport = m.authorRole === "admin";
            return (
              <li key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] space-y-1.5 rounded-lg border px-3.5 py-2.5 text-sm ${
                    m.internal
                      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
                      : isSupport
                        ? "border-primary/30 bg-primary/5"
                        : "bg-card"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {isSupport ? t("common.dispute.support") : mine ? t("nav.profile") : m.authorRole}
                    </span>
                    {m.internal && (
                      <Badge
                        variant="outline"
                        className="border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      >
                        <Lock className="mr-1 h-3 w-3" /> {t("common.dispute.internalBadge")}
                      </Badge>
                    )}
                    <span>{timeAgo(m.at)}</span>
                  </div>
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  <EvidenceGrid ids={m.fileIds} columns={3} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {locked ? (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t("common.dispute.status.closed")}</AlertTitle>
        </Alert>
      ) : (
        <div className="space-y-2 rounded-lg border p-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("common.dispute.replyPlaceholder")}
            rows={3}
            maxLength={4000}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                <Paperclip className="mr-1.5 h-3.5 w-3.5" /> {t("chat.attachFile")}
              </Button>
              {files.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="inline-flex max-w-[10rem] items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                >
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    aria-label={t("common.dispute.removeFile")}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <Button size="sm" onClick={send} disabled={busy || (!body.trim() && files.length === 0)}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {t("common.dispute.send")}
            </Button>
          </div>
          {isAdmin && (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-input"
              />
              <span className="font-medium">{t("common.dispute.internalNote")}</span>
              <span className="text-muted-foreground">{t("common.dispute.internalNoteHint")}</span>
            </label>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- timeline -------------------------------- */

export function prettyAction(action?: string | null): string {
  if (!action) return "—";
  return action
    .replace(/^dispute_/, "")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function DisputeTimelineList({ entries }: { entries: DisputeTimelineEntry[] }) {
  const { t } = useLocale();
  const label = useDisputeLabels();
  const sorted = [...(entries || [])].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("common.dispute.noTimeline")}</p>;
  }
  return (
    <ul className="space-y-3">
      {sorted.map((e, i) => (
        <li key={i} className="relative border-l-2 border-muted pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{prettyAction(e.action)}</span>
            <span className="text-[11px] text-muted-foreground">{fmtDateTime(e.at)}</span>
          </div>
          {(e.from || e.to) && (
            <p className="text-xs text-muted-foreground">
              {e.from ? label(e.from) : "—"} → {e.to ? label(e.to) : "—"}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {e.actorRole || "system"}
            {e.note ? ` · ${e.note}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------- detail body ------------------------------ */

export function DisputeSummaryGrid({ dispute }: { dispute: DisputeT }) {
  const { t } = useLocale();
  const booking = dispute.bookingId as { _id: string; code: string; title: string };
  const rows: { label: string; value: ReactNode }[] = [
    { label: t("common.dispute.raisedOn"), value: fmtDateTime(dispute.createdAt) },
    {
      label: t("common.dispute.lastUpdate"),
      value: dispute.lastMessageAt ? timeAgo(dispute.lastMessageAt) : timeAgo(dispute.updatedAt || dispute.createdAt),
    },
    { label: t("admin.disputes.raisedBy"), value: `${dispute.raisedBy?.name} (${dispute.raisedBy?.phone || "—"})` },
    {
      label: t("admin.disputes.against"),
      value: `${dispute.againstUserId?.name} (${dispute.againstUserId?.phone || "—"})`,
    },
    { label: t("admin.disputes.categoryLabel"), value: dispute.category },
  ];
  if (booking && typeof booking === "object" && booking.code) {
    rows.push({
      label: t("common.dispute.booking"),
      value: (
        <Link
          href={`/dashboard/customer/bookings/${booking._id}`}
          className="text-primary underline-offset-2 hover:underline"
        >
          {booking.code} · {booking.title}
        </Link>
      ),
    });
  }
  if (dispute.firstResponseAt) {
    rows.push({ label: t("common.dispute.lastUpdate"), value: fmtDateTime(dispute.firstResponseAt) });
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((r, i) => (
        <div key={i}>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {r.label}
          </dt>
          <dd className="mt-0.5 break-words text-sm">{r.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

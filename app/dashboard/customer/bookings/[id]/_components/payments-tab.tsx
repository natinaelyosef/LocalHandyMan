"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Eye,
  Loader2,
  Upload,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, etb, fileUrl, fmtDate, fmtDateTime } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import type { BookingDetail, PaymentAccount, PaymentPhase, Proof } from "@/app/dashboard/customer/_lib/types";
import { FieldError, StatusBadge, errText, todayStr } from "@/app/dashboard/customer/_lib/ui";

export function PaymentsTab({ data, reload }: { data: BookingDetail; reload: () => void }) {
  const { toast } = useToast();
  const { t } = useLocale();
  const phases = data.paymentPhases || [];
  const ps = data.booking.paymentSummary || { total: 0, verified: 0, pending: 0, remaining: 0 };

  const phaseAccount = phases
    .map((p) => p.paymentAccountId)
    .find((v): v is PaymentAccount => !!v && typeof v !== "string");
  const account: PaymentAccount | null = phaseAccount || data.accounts?.[0] || null;

  const [proofFor, setProofFor] = useState<PaymentPhase | null>(null);
  const [form, setForm] = useState({
    amountPaid: "",
    reference: "",
    senderName: "",
    senderAccount: "",
    paidAt: todayStr(),
    note: "",
  });
  const [shot, setShot] = useState<File | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const openProof = (p: PaymentPhase) => {
    setProofFor(p);
    setForm({
      amountPaid: String(p.amount || ""),
      reference: p.proof?.reference || "",
      senderName: p.proof?.senderName || "",
      senderAccount: p.proof?.senderAccount || "",
      paidAt: todayStr(),
      note: "",
    });
    setShot(null);
    setErrs({});
  };

  const set = (k: keyof typeof form, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    const amount = Number(form.amountPaid);
    if (!form.amountPaid || Number.isNaN(amount) || amount <= 0) e.amountPaid = t("customer.payments.errAmount");
    if (form.reference.trim().length < 4) e.reference = t("customer.payments.errReference");
    if (!form.senderName.trim()) e.senderName = t("customer.payments.errSender");
    if (!form.paidAt) e.paidAt = t("customer.payments.errDate");
    if (!shot) e.shot = t("customer.payments.errScreenshot");
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!proofFor || !validate()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("amountPaid", form.amountPaid);
      fd.append("reference", form.reference.trim());
      fd.append("senderName", form.senderName.trim());
      fd.append("senderAccount", form.senderAccount.trim());
      fd.append("paidAt", form.paidAt);
      fd.append("note", form.note.trim());
      fd.append("bank", account?.bank || "Commercial Bank of Ethiopia");
      fd.append("screenshot", shot as File);
      const res = await api<{ warning?: string; message?: string }>(
        `/api/payments/phases/${proofFor._id}/proof`,
        { form: fd }
      );
      toast({
        title: res.warning ? t("customer.payments.proofWarningTitle") : t("customer.payments.proofSubmittedTitle"),
        description: res.warning || res.message || t("customer.payments.proofSubmittedDesc"),
      });
      setProofFor(null);
      reload();
    } catch (e) {
      toast({ title: t("customer.payments.proofFailed"), description: errText(e, t), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const copyAccount = async () => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account.accountNumber);
      toast({ title: t("customer.payments.copiedTitle"), description: account.accountNumber });
    } catch {
      toast({ title: t("customer.payments.copyFailed"), description: account.accountNumber });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 p-4 sm:flex-row sm:items-start">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-semibold text-amber-900 dark:text-amber-200">{t("customer.payments.noHoldTitle")}</p>
          <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">{t("customer.payments.noHoldDesc")}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label={t("customer.payments.totalRequired")} value={etb(ps.total)} />
        <MiniStat
          label={t("customer.overviewTab.verifiedPaid")}
          value={etb(ps.verified)}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <MiniStat
          label={t("customer.overviewTab.pendingVerification")}
          value={etb(ps.pending)}
          tone="text-amber-600 dark:text-amber-400"
        />
        <MiniStat label={t("customer.payments.remaining")} value={etb(ps.remaining)} />
      </div>

      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">
            {account ? t("customer.payments.payVia", { bank: account.bank }) : t("customer.payments.accountTitle")}
          </h3>
        </div>
        {account ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <InfoCell label={t("customer.payments.accountName")} value={account.accountName} />
              <InfoCell label={t("customer.payments.accountNumber")} value={account.accountNumber} />
              <InfoCell label={t("customer.payments.branch")} value={account.branch || "—"} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={copyAccount}>
                <ClipboardCopy className="mr-2 h-4 w-4" /> {t("customer.payments.copyNumber")}
              </Button>
              <span className="text-xs text-muted-foreground">{t("customer.payments.transferHint")}</span>
            </div>
            {account.instructions && (
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 font-sans text-sm leading-relaxed text-muted-foreground">
                {account.instructions}
              </pre>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("customer.payments.noAccount")}</p>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{t("customer.payments.phasesTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("customer.payments.phasesSub")}</p>
        </div>

        {phases.length === 0 && (
          <div className="rounded-xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {t("customer.payments.noPhases")}
          </div>
        )}

        {phases.map((p) => {
          const proof = p.proof || null;
          const canSubmit = ["UNPAID", "PAYMENT_DUE", "REJECTED"].includes(p.status);
          const awaiting = ["PROOF_SUBMITTED", "UNDER_VERIFICATION"].includes(p.status);
          return (
            <div key={p._id} className="rounded-xl border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {p.order}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold">{p.label}</h4>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.purpose && <p className="text-sm text-muted-foreground">{p.purpose}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {p.dueDate && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {t("customer.payments.due", { date: fmtDate(p.dueDate) })}
                      </span>
                    )}
                    {p.paidAt && <span>{t("customer.payments.paidOn", { date: fmtDate(p.paidAt) })}</span>}
                    {p.verifiedAt && <span>{t("customer.payments.verifiedOn", { date: fmtDate(p.verifiedAt) })}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">{etb(p.amount)}</p>
                  {p.paidVerified ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {t("customer.payments.verifiedAmount", { amount: etb(p.paidVerified) })}
                    </p>
                  ) : null}
                </div>
              </div>

              {canSubmit && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  {p.status === "REJECTED" && (
                    <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 p-3">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-300">
                        <AlertTriangle className="h-4 w-4" /> {t("customer.payments.proofRejected")}
                      </p>
                      <p className="mt-0.5 text-sm text-red-700 dark:text-red-300">
                        {p.rejectionReason || proof?.rejectionReason || t("customer.payments.proofRejectedFallback")}
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {t("customer.payments.transferLine", { amount: etb(p.amount) })}
                    </p>
                    <Button size="sm" onClick={() => openProof(p)}>
                      <Upload className="mr-2 h-4 w-4" />
                      {p.status === "REJECTED" ? t("customer.payments.resubmit") : t("customer.payments.submit")}
                    </Button>
                  </div>
                </div>
              )}

              {awaiting && proof && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 p-3 text-sm text-amber-800 dark:text-amber-300">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Clock className="h-4 w-4" /> {t("customer.payments.pendingTitle")}
                    </span>
                    {t("customer.payments.pendingDesc")}
                  </div>
                  <ProofCard proof={proof} />
                </div>
              )}

              {p.status === "VERIFIED" && (
                <div className="mt-4 space-y-3 border-t pt-4">
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/60 p-3 text-sm text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="h-4 w-4" />{" "}
                      {t("customer.payments.verifiedTitle", { amount: etb(p.paidVerified || p.amount) })}
                    </span>
                    {t("customer.payments.verifiedDesc", { date: fmtDate(p.verifiedAt || p.paidAt) })}
                  </div>
                  {proof && <ProofCard proof={proof} />}
                </div>
              )}

              {p.status === "CANCELLED" && (
                <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">{t("customer.payments.cancelled")}</p>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!proofFor} onOpenChange={(o) => !o && setProofFor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("customer.payments.dialogTitle", { label: proofFor?.label || "" })}</DialogTitle>
            <DialogDescription>
              {t("customer.payments.dialogDesc", { amount: etb(proofFor?.amount || 0) })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amountPaid">{t("customer.payments.amountPaid")} *</Label>
              <Input
                id="amountPaid"
                type="number"
                min={1}
                value={form.amountPaid}
                onChange={(e) => set("amountPaid", e.target.value)}
              />
              <FieldError msg={errs.amountPaid} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">{t("customer.payments.reference")} *</Label>
              <Input
                id="reference"
                placeholder={t("customer.payments.referencePlaceholder")}
                value={form.reference}
                onChange={(e) => set("reference", e.target.value)}
              />
              <FieldError msg={errs.reference} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderName">{t("customer.payments.senderName")} *</Label>
              <Input
                id="senderName"
                placeholder={t("customer.payments.senderNamePlaceholder")}
                value={form.senderName}
                onChange={(e) => set("senderName", e.target.value)}
              />
              <FieldError msg={errs.senderName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senderAccount">{t("customer.payments.senderAccount")}</Label>
              <Input
                id="senderAccount"
                placeholder={t("customer.payments.senderAccountPlaceholder")}
                value={form.senderAccount}
                onChange={(e) => set("senderAccount", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paidAt">{t("customer.payments.paymentDate")} *</Label>
              <Input id="paidAt" type="date" value={form.paidAt} max={todayStr()} onChange={(e) => set("paidAt", e.target.value)} />
              <FieldError msg={errs.paidAt} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proofNote">{t("customer.payments.noteOptional")}</Label>
              <Input
                id="proofNote"
                placeholder={t("customer.payments.notePlaceholder")}
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="screenshot">{t("customer.payments.screenshot")} *</Label>
            <Input
              id="screenshot"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setShot(e.target.files?.[0] || null)}
            />
            {shot && <p className="text-xs text-muted-foreground">{t("customer.payments.attached", { name: shot.name })}</p>}
            <FieldError msg={errs.shot} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProofFor(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {t("customer.payments.submitProof")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Wallet className="h-3.5 w-3.5" /> {label}
      </p>
      <p className={`mt-1 text-xl font-bold ${tone || ""}`}>{value}</p>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-all text-sm font-semibold">{value}</p>
    </div>
  );
}

function ProofCard({ proof }: { proof: Proof }) {
  const { t } = useLocale();
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-start gap-3">
        <a
          href={fileUrl(proof.screenshotFileId)}
          target="_blank"
          rel="noreferrer"
          className="block h-20 w-24 shrink-0 overflow-hidden rounded-lg border bg-background"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(proof.screenshotFileId)}
            alt={t("customer.payments.screenshotAlt")}
            className="h-full w-full object-cover"
          />
        </a>
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p className="flex items-center gap-1.5 font-semibold">
            <Eye className="h-4 w-4 text-muted-foreground" /> {proof.reference}
            <StatusBadge status={proof.status === "pending" ? "PENDING" : proof.status === "verified" ? "VERIFIED" : "REJECTED"} />
          </p>
          <p className="text-muted-foreground">
            {t("customer.payments.proofLine", {
              paid: etb(proof.amountPaid),
              required: etb(proof.requiredAmount),
              date: fmtDateTime(proof.paidAt),
            })}
          </p>
          <p className="text-muted-foreground">
            {proof.senderName}
            {proof.senderAccount ? ` · ${proof.senderAccount}` : ""}
            {proof.bank ? ` · ${proof.bank}` : ""}
          </p>
          {proof.reviewedAt && (
            <p className="text-xs text-muted-foreground">
              {t("customer.payments.reviewed", { date: fmtDateTime(proof.reviewedAt) })}
            </p>
          )}
          {proof.rejectionReason && (
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              {t("customer.payments.reason", { reason: proof.rejectionReason })}
            </p>
          )}
          {proof.duplicateFlag && (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              {t("customer.payments.duplicate")}
            </p>
          )}
          {!!proof.underpaidBy && proof.underpaidBy > 0 && (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {t("customer.payments.underpaid", { amount: etb(proof.underpaidBy) })}
            </p>
          )}
          {!!proof.overpaidBy && proof.overpaidBy > 0 && (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {t("customer.payments.overpaid", { amount: etb(proof.overpaidBy) })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

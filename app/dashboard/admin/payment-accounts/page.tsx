"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Building2, Pencil, Plus, RefreshCw, Star, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { EmptyState, ErrorAlert, Field } from "../_shared";

interface Account {
  _id: string;
  bank: string;
  accountName: string;
  accountNumber: string;
  branch: string;
  instructions: string;
  active: boolean;
  order: number;
}

const DEFAULT_BANK = "Commercial Bank of Ethiopia";

export default function AdminPaymentAccountsPage() {
  const { toast } = useToast();
  const { t } = useLocale();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<Account | null>(null);
  const [deleteAcc, setDeleteAcc] = useState<Account | null>(null);

  const [bank, setBank] = useState(DEFAULT_BANK);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branch, setBranch] = useState("");
  const [instructions, setInstructions] = useState("");
  const [active, setActive] = useState(true);
  const [order, setOrder] = useState("0");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api<{ accounts: Account[] }>("/api/payment-accounts")
      .then((d) => setAccounts(d.accounts || []))
      .catch((e) => setError(e instanceof Error ? e.message : t("admin.errors.loadAccounts")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setBank(DEFAULT_BANK);
    setAccountName("");
    setAccountNumber("");
    setBranch("");
    setInstructions("");
    setActive(true);
    setOrder("0");
    setDialogError("");
  };

  const openAdd = () => {
    resetForm();
    setAddOpen(true);
  };

  const openEdit = (a: Account) => {
    resetForm();
    setBank(a.bank || DEFAULT_BANK);
    setAccountName(a.accountName);
    setAccountNumber(a.accountNumber);
    setBranch(a.branch || "");
    setInstructions(a.instructions || "");
    setActive(!!a.active);
    setOrder(String(a.order ?? 0));
    setEditAcc(a);
  };

  const setAsActive = async (a: Account) => {
    setBusy(true);
    try {
      await api("/api/payment-accounts", { method: "PATCH", body: { id: a._id, active: true } });
      toast({ title: t("admin.accounts.activeUpdated"), description: `${a.bank} · ${a.accountNumber}` });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.updateFailed");
      toast({ title: t("admin.errors.updateFailed"), description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const submitForm = async () => {
    if (!accountName.trim() || !accountNumber.trim()) {
      setDialogError(t("admin.accounts.requiredFields"));
      return;
    }
    setBusy(true);
    setDialogError("");
    const body = {
      bank: bank.trim() || DEFAULT_BANK,
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      branch: branch.trim(),
      instructions: instructions.trim(),
      active,
      order: Number(order) || 0,
    };
    try {
      if (editAcc) {
        await api("/api/payment-accounts", { method: "PATCH", body: { id: editAcc._id, ...body } });
        toast({ title: t("admin.accounts.updated"), description: body.accountNumber });
      } else {
        await api("/api/payment-accounts", { body });
        toast({ title: t("admin.accounts.added"), description: body.accountNumber });
      }
      setAddOpen(false);
      setEditAcc(null);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.saveFailed");
      setDialogError(msg);
      toast({ title: t("admin.errors.saveFailed"), description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteAcc) return;
    setBusy(true);
    try {
      await api("/api/payment-accounts", { method: "DELETE", body: { id: deleteAcc._id } });
      toast({ title: t("admin.accounts.removed"), description: deleteAcc.accountNumber });
      setDeleteAcc(null);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.deleteFailed");
      toast({ title: t("admin.errors.deleteFailed"), description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const formDialog = (
    <Dialog
      open={addOpen || !!editAcc}
      onOpenChange={(o) => {
        if (!o) {
          setAddOpen(false);
          setEditAcc(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editAcc ? t("admin.accounts.editTitle") : t("admin.accounts.addTitle")}</DialogTitle>
          <DialogDescription>{t("admin.accounts.formDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="acc-bank">{t("admin.accounts.bank")}</Label>
            <Input id="acc-bank" value={bank} onChange={(e) => setBank(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acc-name">{t("admin.accounts.accountName")}</Label>
              <Input id="acc-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-number">{t("admin.accounts.accountNumber")}</Label>
              <Input id="acc-number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-branch">{t("admin.accounts.branch")}</Label>
              <Input id="acc-branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-order">{t("admin.order")}</Label>
              <Input id="acc-order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-instructions">{t("admin.accounts.instructionsLabel")}</Label>
            <Textarea
              id="acc-instructions"
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={t("admin.accounts.instructionsPlaceholder")}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
            {t("admin.accounts.activeCheck")}
          </label>
          {dialogError && <p className="text-sm text-red-600 dark:text-red-400">{dialogError}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setAddOpen(false);
              setEditAcc(null);
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button disabled={busy} onClick={submitForm}>
            {busy ? t("admin.saving") : editAcc ? t("admin.saveChanges") : t("admin.accounts.addAccount")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <DashboardShell
      role="admin"
      nav={ADMIN_NAV}
      title={t("nav.cbeAccounts")}
      subtitle={t("admin.accounts.subtitle")}
    >
      <div className="max-w-7xl space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("admin.accounts.howTitle")}</AlertTitle>
          <AlertDescription>{t("admin.accounts.howDesc")}</AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t("admin.accounts.counts", {
              n: accounts.length,
              active: accounts.filter((a) => a.active).length,
            })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {t("common.refresh")}
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-4 w-4" /> {t("admin.accounts.addAccount")}
            </Button>
          </div>
        </div>

        {error && <ErrorAlert error={error} onRetry={load} />}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="space-y-3 py-6">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={t("admin.accounts.emptyTitle")}
            desc={t("admin.accounts.emptyDesc")}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((a) => (
              <Card key={a._id} className={a.active ? "border-emerald-300 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/40" : ""}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> {a.bank}
                    </span>
                    {a.active ? (
                      <Badge className="border-transparent bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">{t("admin.status.active")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("admin.inactive")}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("admin.accounts.accountName")} value={a.accountName} />
                    <Field label={t("admin.accounts.accountNumber")} value={<span className="font-mono">{a.accountNumber}</span>} />
                    <Field label={t("admin.accounts.branch")} value={a.branch} />
                    <Field label={t("admin.order")} value={a.order} />
                  </div>
                  {a.instructions && (
                    <div className="rounded-md border bg-muted/40 p-2.5">
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("admin.accounts.instructions")}
                      </p>
                      <p className="whitespace-pre-line text-xs text-muted-foreground">{a.instructions}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                    {!a.active && (
                      <Button size="sm" disabled={busy} onClick={() => setAsActive(a)}>
                        <Star className="mr-1.5 h-3.5 w-3.5" /> {t("admin.accounts.setActive")}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> {t("common.edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 dark:text-red-400"
                      onClick={() => setDeleteAcc(a)}
                      disabled={a.active && accounts.filter((x) => x.active).length === 1 && accounts.length === 1}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {t("common.delete")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {formDialog}

        <AlertDialog open={!!deleteAcc} onOpenChange={(o) => !o && setDeleteAcc(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.accounts.removeTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.accounts.removeDesc", { bank: deleteAcc?.bank || "", number: deleteAcc?.accountNumber || "" })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction disabled={busy} onClick={confirmDelete}>
                {busy ? t("admin.accounts.removing") : t("admin.accounts.removeAccount")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardShell>
  );
}

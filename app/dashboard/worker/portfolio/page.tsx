"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, FolderKanban, Images, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { WORKER_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, fileUrl, fmtDate } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { EmptyState, ErrorState, PageSkeleton, useErrMsg, type PortfolioItemT, type WorkerProfileT } from "../_shared";

export default function WorkerPortfolioPage() {
  const { t } = useLocale();
  const errMsg = useErrMsg();
  const { toast } = useToast();
  const [profile, setProfile] = useState<WorkerProfileT | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [completedAt, setCompletedAt] = useState("");
  const [before, setBefore] = useState<File | null>(null);
  const [during, setDuring] = useState<File | null>(null);
  const [after, setAfter] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api<{ profile: WorkerProfileT | null }>("/api/worker/profile");
      setProfile(d.profile);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [errMsg]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setDescription("");
    setArea("");
    setCompletedAt("");
    setBefore(null);
    setDuring(null);
    setAfter(null);
  };

  const add = async () => {
    if (!title.trim()) {
      toast({ title: t("worker.portfolio.titleRequired"), variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("category", category.trim());
      form.append("description", description.trim());
      form.append("area", area.trim());
      if (completedAt) form.append("completedAt", completedAt);
      if (before) form.append("before", before);
      if (during) form.append("during", during);
      if (after) form.append("after", after);
      const d = await api<{ portfolio: PortfolioItemT[] }>("/api/worker/portfolio", { form });
      if (profile) setProfile({ ...profile, portfolio: d.portfolio });
      toast({ title: t("worker.portfolio.itemAdded") });
      setOpen(false);
      resetForm();
    } catch (err) {
      toast({ title: t("worker.portfolio.addFailed"), description: errMsg(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: PortfolioItemT) => {
    if (!window.confirm(t("worker.portfolio.deleteConfirm", { title: item.title }))) return;
    try {
      const d = await api<{ portfolio: PortfolioItemT[] }>(`/api/worker/portfolio?id=${encodeURIComponent(item._id)}`, {
        method: "DELETE",
      });
      if (profile) setProfile({ ...profile, portfolio: d.portfolio });
      toast({ title: t("worker.portfolio.itemDeleted") });
    } catch (err) {
      toast({ title: t("worker.portfolio.couldNotDelete"), description: errMsg(err), variant: "destructive" });
    }
  };

  const items = profile?.portfolio || [];

  return (
    <DashboardShell role="worker" nav={WORKER_NAV} title={t("nav.portfolio")} subtitle={t("worker.portfolio.subtitle")}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-muted-foreground">{t("worker.portfolio.intro")}</p>
          <div className="flex gap-2">
            {profile && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/workers/${profile.userId}`}>
                  <ExternalLink className="mr-1.5 h-4 w-4" /> {t("worker.profile.viewPublic")}
                </Link>
              </Button>
            )}
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> {t("worker.portfolio.addBtn")}
            </Button>
          </div>
        </div>

        {loading && <PageSkeleton rows={3} />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon={FolderKanban}
            title={t("worker.portfolio.emptyTitle")}
            hint={t("worker.portfolio.emptyHint")}
            action={
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> {t("worker.portfolio.addFirst")}
              </Button>
            }
          />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const shots = [
                { key: "before", label: t("worker.evidence.before"), id: item.beforeFileId },
                { key: "during", label: t("worker.evidence.during"), id: item.duringFileId },
                { key: "after", label: t("worker.evidence.after"), id: item.afterFileId },
              ].filter((s) => s.id);
              return (
                <div key={item._id} className="flex flex-col overflow-hidden rounded-xl border bg-card">
                  {shots.length > 0 ? (
                    <div className="grid grid-cols-3 gap-px bg-muted">
                      {shots.map((s) => (
                        <a key={s.key} href={fileUrl(s.id)} target="_blank" rel="noreferrer" className="relative block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fileUrl(s.id)} alt={`${item.title} ${s.label}`} loading="lazy" decoding="async" className="h-32 w-full object-cover" />
                          <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {s.label}
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-24 items-center justify-center bg-muted/50 text-muted-foreground">
                      <Images className="h-6 w-6" />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-tight">{item.title}</h3>
                      <button
                        onClick={() => void remove(item)}
                        className="rounded-md p-1 text-muted-foreground transition hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-600 dark:hover:text-red-400"
                        aria-label={t("worker.portfolio.deleteAria")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {item.category && (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{item.category}</span>
                      )}
                      {item.area && (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{item.area}</span>
                      )}
                      {item.completedAt && (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                          {fmtDate(item.completedAt)}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("worker.portfolio.addTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pf-title">{t("worker.portfolio.formTitle")}</Label>
                <Input id="pf-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("worker.portfolio.formTitlePlaceholder")} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pf-category">{t("common.category")}</Label>
                  <Input id="pf-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("worker.portfolio.categoryPlaceholder")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pf-area">{t("worker.portfolio.areaLabel")}</Label>
                  <Input id="pf-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder={t("worker.portfolio.areaPlaceholder")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-desc">{t("common.description")}</Label>
                <Textarea id="pf-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("worker.portfolio.descPlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pf-date">{t("worker.portfolio.completedOn")}</Label>
                <Input id="pf-date" type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { key: "before", labelKey: "worker.evidence.before", file: before, set: setBefore },
                  { key: "during", labelKey: "worker.evidence.during", file: during, set: setDuring },
                  { key: "after", labelKey: "worker.evidence.after", file: after, set: setAfter },
                ].map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label htmlFor={`pf-${f.key}`}>{t("worker.portfolio.photoLabel", { kind: t(f.labelKey) })}</Label>
                    <Input
                      id={`pf-${f.key}`}
                      type="file"
                      accept="image/*"
                      onChange={(e) => f.set(e.target.files?.[0] || null)}
                    />
                    {f.file && <p className="truncate text-xs text-muted-foreground">{f.file.name}</p>}
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => void add()} disabled={busy}>
                {busy ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
                {busy ? t("worker.portfolio.uploading") : t("worker.portfolio.addItem")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}

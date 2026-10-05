"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderPlus, Layers, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { EmptyState, ErrorAlert } from "../_shared";

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent: string | null;
  active: boolean;
  order: number;
  tags?: string[];
}

interface CategoriesResp {
  categories: Category[];
  tree: (Category & { children: Category[] })[];
}

const NONE = "none";

export default function AdminCategoriesPage() {
  const { toast } = useToast();
  const { t } = useLocale();
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [deleteCat, setDeleteCat] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [parent, setParent] = useState(NONE);
  const [order, setOrder] = useState("0");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api<CategoriesResp>("/api/categories")
      .then((d) => setCats(d.categories || []))
      .catch((e) => setError(e instanceof Error ? e.message : t("admin.errors.loadCategories")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setIcon("");
    setParent(NONE);
    setOrder("0");
    setDialogError("");
  };

  const parents = cats.filter((c) => !c.parent).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const childrenOf = (id: string) =>
    cats.filter((c) => c.parent === id).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const toggleActive = async (cat: Category) => {
    try {
      await api(`/api/categories/${cat._id}`, { method: "PATCH", body: { active: !cat.active } });
      setCats((prev) => prev.map((c) => (c._id === cat._id ? { ...c, active: !cat.active } : c)));
      toast({
        title: cat.active ? t("admin.cats.deactivated") : t("admin.cats.activated"),
        description: cat.active
          ? t("admin.cats.deactivatedDesc", { name: cat.name })
          : t("admin.cats.activatedDesc", { name: cat.name }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.updateFailed");
      toast({ title: t("admin.errors.updateFailed"), description: msg, variant: "destructive" });
    }
  };

  const openAdd = (presetParent?: string) => {
    resetForm();
    if (presetParent) setParent(presetParent);
    setAddOpen(true);
  };

  const openEdit = (cat: Category) => {
    resetForm();
    setName(cat.name);
    setDescription(cat.description || "");
    setIcon(cat.icon || "");
    setParent(cat.parent || NONE);
    setOrder(String(cat.order ?? 0));
    setEditCat(cat);
  };

  const submitForm = async (isEdit: boolean) => {
    if (!name.trim()) {
      setDialogError(t("admin.cats.nameRequired"));
      return;
    }
    setBusy(true);
    setDialogError("");
    const body = {
      name: name.trim(),
      description: description.trim(),
      icon: icon.trim(),
      parent: parent === NONE ? null : parent,
      order: Number(order) || 0,
    };
    try {
      if (isEdit && editCat) {
        await api(`/api/categories/${editCat._id}`, { method: "PATCH", body });
        toast({ title: t("admin.cats.updated"), description: body.name });
      } else {
        await api("/api/categories", { body });
        toast({ title: t("admin.cats.created"), description: body.name });
      }
      setAddOpen(false);
      setEditCat(null);
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
    if (!deleteCat) return;
    setBusy(true);
    setDeleteError("");
    try {
      await api(`/api/categories/${deleteCat._id}`, { method: "DELETE" });
      toast({ title: t("admin.cats.deleted"), description: deleteCat.name });
      setDeleteCat(null);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.deleteFailed");
      setDeleteError(msg);
      toast({ title: t("admin.cats.cannotDelete"), description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const parentOptions = (excludeId?: string) =>
    parents.filter((p) => p._id !== excludeId && p.active);

  const renderRow = (cat: Category, isChild: boolean) => (
    <div
      key={cat._id}
      className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5 ${
        isChild ? "bg-muted/30" : ""
      } ${cat.active ? "" : "opacity-60"}`}
    >
      <span className="w-7 text-center text-lg" aria-hidden>
        {cat.icon || "•"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-medium ${isChild ? "" : "font-semibold"}`}>{cat.name}</span>
          <code className="text-[11px] text-muted-foreground">{cat.slug}</code>
          {!cat.active && (
            <Badge variant="outline" className="text-muted-foreground">
              {t("admin.inactive")}
            </Badge>
          )}
        </div>
        {cat.description && <p className="truncate text-xs text-muted-foreground">{cat.description}</p>}
      </div>
      <span className="text-xs text-muted-foreground">{t("admin.cats.orderLabel", { n: cat.order })}</span>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={cat.active} onCheckedChange={() => toggleActive(cat)} aria-label={t("admin.status.active")} />
        {cat.active ? t("admin.status.active") : t("admin.inactive")}
      </label>
      {!isChild && (
        <Button size="sm" variant="ghost" onClick={() => openAdd(cat._id)}>
          <FolderPlus className="mr-1 h-3.5 w-3.5" /> {t("admin.cats.addSub")}
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => openEdit(cat)}>
        <Pencil className="mr-1 h-3.5 w-3.5" /> {t("common.edit")}
      </Button>
      <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => { setDeleteError(""); setDeleteCat(cat); }}>
        <Trash2 className="mr-1 h-3.5 w-3.5" /> {t("common.delete")}
      </Button>
    </div>
  );

  const formDialog = (
    <Dialog
      open={addOpen || !!editCat}
      onOpenChange={(o) => {
        if (!o) {
          setAddOpen(false);
          setEditCat(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editCat ? t("admin.cats.editTitle") : t("admin.cats.addTitle")}</DialogTitle>
          <DialogDescription>
            {editCat ? t("admin.cats.editDesc") : t("admin.cats.addDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">{t("admin.cats.nameLabel")}</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("admin.cats.namePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">{t("common.description")}</Label>
            <Textarea
              id="cat-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("admin.cats.descPlaceholder")}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-icon">{t("admin.cats.iconLabel")}</Label>
              <Input id="cat-icon" value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🔧" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-order">{t("admin.order")}</Label>
              <Input
                id="cat-order"
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-parent">{t("admin.cats.parent")}</Label>
              <Select value={parent} onValueChange={setParent}>
                <SelectTrigger id="cat-parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("admin.cats.noneTop")}</SelectItem>
                  {parentOptions(editCat?._id).map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.icon ? `${p.icon} ` : ""}
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {dialogError && <p className="text-sm text-red-600 dark:text-red-400">{dialogError}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setAddOpen(false);
              setEditCat(null);
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button disabled={busy} onClick={() => submitForm(!!editCat)}>
            {busy ? t("admin.saving") : editCat ? t("admin.saveChanges") : t("admin.cats.createCategory")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <DashboardShell
      role="admin"
      nav={ADMIN_NAV}
      title={t("nav.services")}
      subtitle={t("admin.cats.subtitle")}
    >
      <div className="max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {t("admin.cats.counts", { n: cats.length, parents: parents.length })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setAddOpen(true); }}>
              <Plus className="mr-1.5 h-4 w-4" /> {t("admin.cats.addCategory")}
            </Button>
          </div>
        </div>

        {error && <ErrorAlert error={error} onRetry={load} />}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : parents.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={t("admin.cats.emptyTitle")}
            desc={t("admin.cats.emptyDesc")}
          />
        ) : (
          <div className="space-y-4">
            {parents.map((p) => {
              const subs = childrenOf(p._id);
              return (
                <Card key={p._id} className={p.active ? "" : "opacity-70"}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span className="text-lg">{p.icon || "📁"}</span> {p.name}
                      <Badge variant="secondary" className="font-normal">
                        {t("admin.cats.subCount", { n: subs.length })}
                      </Badge>
                      {!p.active && <Badge variant="outline">{t("admin.inactive")}</Badge>}
                      <span className="ml-auto text-xs font-normal text-muted-foreground">{t("admin.cats.orderLabel", { n: p.order })}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {renderRow(p, false)}
                    {subs.length > 0 && <div className="ml-4 space-y-2 border-l pl-4">{subs.map((s) => renderRow(s, true))}</div>}
                    {subs.length === 0 && (
                      <p className="pl-1 text-xs text-muted-foreground">{t("admin.cats.noSubs")}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {formDialog}

        <AlertDialog open={!!deleteCat} onOpenChange={(o) => !o && setDeleteCat(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.cats.deleteTitle", { name: deleteCat?.name || "" })}</AlertDialogTitle>
              <AlertDialogDescription>
                {childrenOf(deleteCat?._id || "").length > 0
                  ? t("admin.cats.deleteDescWithSubs")
                  : t("admin.cats.deleteDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError && (
              <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 p-3 text-sm text-amber-900 dark:text-amber-200">
                {deleteError}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction disabled={busy} onClick={confirmDelete}>
                {busy ? t("admin.cats.deleting") : t("admin.cats.deleteCategory")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardShell>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileSearch,
  HardHat,
  MapPin,
  RefreshCw,
  Search,
  Star,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, etb, fileUrl, fmtDate, fmtDateTime } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import {
  EmptyState,
  ErrorAlert,
  Field,
  ListSkeleton,
  Pagination,
  StatusPill,
  initials,
  qs,
  useStatusLabel,
} from "../_shared";

interface WorkerDocT {
  _id: string;
  type: string;
  title: string;
  fileId?: string | null;
  status: string;
  reviewNote?: string;
  reviewedAt?: string | null;
}

interface WorkerItemT {
  _id: string;
  userId: string;
  profession: string;
  headline?: string;
  bio?: string;
  skills?: string[];
  yearsOfExperience?: number;
  languages?: string[];
  startingPrice?: number;
  serviceArea?: { region?: string; city?: string; woreda?: string; radiusKm?: number };
  availability?: string;
  emergencyAvailable?: boolean;
  status: string;
  statusNote?: string;
  verifiedAt?: string | null;
  documents?: WorkerDocT[];
  portfolio?: unknown[];
  stats?: { jobsCompleted: number; ratingSum: number; ratingCount: number };
  responseTimeMinutes?: number;
  featured?: boolean;
  schedule?: { day: string; open: string; close: string; closed?: boolean }[];
  createdAt: string;
  user: {
    name: string;
    email: string;
    phone: string;
    status: string;
    createdAt: string;
    avatarFileId?: string | null;
  };
}

interface WorkersResp {
  items: WorkerItemT[];
  total: number;
  pages: number;
  counts: Record<string, number>;
}

const FILTERS = [
  { value: "pending", key: "admin.workers.filterPending" },
  { value: "approved", key: "admin.workers.filterApproved" },
  { value: "rejected", key: "common.verification.rejected" },
  { value: "suspended", key: "admin.status.suspended" },
  { value: "resubmit_required", key: "admin.workers.filterResubmit" },
  { value: "all", key: "common.all" },
];

const DOC_STATUS: Record<string, string> = {
  pending: "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300",
  approved: "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300",
};

type WorkerActionState = {
  action: string;
  title: string;
  description: string;
  requireNote: boolean;
} | null;

type DocActionState = {
  doc: WorkerDocT;
  mode: "approved" | "rejected";
} | null;

export default function AdminWorkersPage() {
  const { toast } = useToast();
  const { t } = useLocale();
  const label = useStatusLabel();
  const [filter, setFilter] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<WorkersResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workerAction, setWorkerAction] = useState<WorkerActionState>(null);
  const [actionNote, setActionNote] = useState("");
  const [docAction, setDocAction] = useState<DocActionState>(null);
  const [docNote, setDocNote] = useState("");
  const [dialogError, setDialogError] = useState("");

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    setFilter(s && (FILTERS.some((f) => f.value === s) || s === "resubmit_required") ? s : "pending");
  }, []);

  const fetchPage = (): Promise<WorkersResp> => {
    const status = filter === "all" || filter === null ? "" : filter;
    return api<WorkersResp>(`/api/admin/workers${qs({ status, q, page, limit: 12 })}`);
  };

  useEffect(() => {
    if (filter === null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchPage()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t("admin.errors.loadWorkers"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page, q]);

  const reload = () => {
    setLoading(true);
    setError("");
    fetchPage()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("admin.errors.loadWorkers")))
      .finally(() => setLoading(false));
  };

  const selected = data?.items.find((i) => i._id === selectedId) || null;

  const runWorkerAction = async (action: string, note: string) => {
    if (!selected) return;
    setBusy(true);
    setDialogError("");
    try {
      await api(`/api/admin/workers/${selected._id}/verify`, { body: { action, note } });
      toast({
        title: t("admin.workers.toastUpdated"),
        description: t("admin.workers.toastUpdatedDesc", { name: selected.user.name, action: label(action) }),
      });
      setWorkerAction(null);
      setActionNote("");
      const resulting: Record<string, string> = {
        approve: "approved",
        reject: "rejected",
        suspend: "suspended",
        reactivate: "pending",
        request_resubmit: "resubmit_required",
      };
      const nextStatus = resulting[action];
      if (nextStatus && filter !== "all" && nextStatus !== filter) setSelectedId(null);
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.actionFailed");
      setDialogError(msg);
      toast({ title: t("admin.errors.actionFailed"), description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const runDocAction = async () => {
    if (!selected || !docAction) return;
    setBusy(true);
    setDialogError("");
    try {
      await api(`/api/admin/workers/${selected._id}/verify`, {
        body: {
          action: "review_document",
          documentId: docAction.doc._id,
          docStatus: docAction.mode,
          note: docNote,
        },
      });
      toast({
        title: docAction.mode === "approved" ? t("admin.workers.docApproved") : t("admin.workers.docRejected"),
        description: docAction.doc.title,
      });
      setDocAction(null);
      setDocNote("");
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.actionFailed");
      setDialogError(msg);
      toast({ title: t("admin.errors.actionFailed"), description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  };

  const counts = data?.counts || {};

  const openWorkerAction = (action: string, title: string, description: string, requireNote: boolean) => {
    setDialogError("");
    setActionNote("");
    setWorkerAction({ action, title, description, requireNote });
  };

  const workerActionButtons = (w: WorkerItemT) => (
    <div className="flex flex-wrap gap-2">
      {w.status !== "approved" && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            openWorkerAction("approve", t("admin.workers.approveTitle"), t("admin.workers.approveDesc"), false)
          }
        >
          <CheckCircle2 className="mr-1.5 h-4 w-4" /> {t("admin.approve")}
        </Button>
      )}
      {w.status !== "rejected" && (
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() =>
            openWorkerAction("reject", t("admin.workers.rejectTitle"), t("admin.workers.rejectDesc"), true)
          }
        >
          <XCircle className="mr-1.5 h-4 w-4" /> {t("admin.workers.reject")}
        </Button>
      )}
      {w.status !== "resubmit_required" && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            openWorkerAction(
              "request_resubmit",
              t("admin.workers.resubmitTitle"),
              t("admin.workers.resubmitDesc"),
              false
            )
          }
        >
          {t("admin.workers.requestResubmit")}
        </Button>
      )}
      {w.status !== "suspended" && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            openWorkerAction("suspend", t("admin.workers.suspendTitle"), t("admin.workers.suspendDesc"), false)
          }
        >
          {t("admin.workers.suspend")}
        </Button>
      )}
      {(w.status === "suspended" || w.status === "rejected") && (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            openWorkerAction(
              "reactivate",
              t("admin.workers.reactivateTitle"),
              t("admin.workers.reactivateDesc"),
              false
            )
          }
        >
          {t("admin.workers.reactivate")}
        </Button>
      )}
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() =>
          openWorkerAction(
            w.featured ? "unfeature" : "feature",
            w.featured ? t("admin.workers.unfeatureTitle") : t("admin.workers.featureTitle"),
            w.featured ? t("admin.workers.unfeatureDesc") : t("admin.workers.featureDesc"),
            false
          )
        }
      >
        {w.featured ? t("admin.workers.unfeature") : t("admin.workers.feature")}
      </Button>
    </div>
  );

  return (
    <DashboardShell
      role="admin"
      nav={ADMIN_NAV}
      title={t("nav.workerVerification")}
      subtitle={t("admin.workers.subtitle")}
    >
      <div className="max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={filter || "pending"}
            onValueChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
          >
            <TabsList className="h-auto flex-wrap">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value} className="gap-2">
                  {t(f.key)}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                      f.value === "pending" && (counts.pending || 0) > 0
                        ? "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {f.value === "all" ? (data ? data.total : 0) : counts[f.value] || 0}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <form onSubmit={onSearch} className="flex gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("admin.workers.searchPlaceholder")}
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
          <ListSkeleton rows={6} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={HardHat}
            title={q ? t("admin.workers.noMatchTitle") : t("admin.workers.emptyListTitle")}
            desc={
              q
                ? t("admin.workers.noMatchDesc", { q })
                : filter === "pending"
                  ? t("admin.workers.emptyPendingDesc")
                  : t("admin.workers.emptyDesc")
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((w) => {
              const rating =
                w.stats && w.stats.ratingCount > 0 ? (w.stats.ratingSum / w.stats.ratingCount).toFixed(1) : null;
              return (
                <Card key={w._id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={w.user.avatarFileId ? fileUrl(w.user.avatarFileId) : ""} alt={w.user.name} />
                        <AvatarFallback>{initials(w.user.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-sm font-semibold">{w.user.name}</CardTitle>
                        <p className="truncate text-xs text-muted-foreground">{w.user.email}</p>
                        <p className="truncate text-xs text-muted-foreground">{w.user.phone}</p>
                      </div>
                      <StatusPill status={w.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary">{w.profession}</Badge>
                      {w.featured && <Badge className="border-transparent bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">{t("admin.workers.featured")}</Badge>}
                      {w.serviceArea?.city && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {w.serviceArea.city}
                        </span>
                      )}
                    </div>
                    {w.headline && <p className="line-clamp-2 text-sm text-muted-foreground">{w.headline}</p>}
                  </CardHeader>
                  <CardContent className="mt-auto space-y-3">
                    <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-2 text-center text-xs">
                      <div>
                        <p className="flex items-center justify-center gap-1 font-semibold">
                          {rating ? (
                            <>
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {rating}
                            </>
                          ) : (
                            "—"
                          )}
                        </p>
                        <p className="text-muted-foreground">{t("admin.workers.rating")}</p>
                      </div>
                      <div>
                        <p className="font-semibold">{w.stats?.jobsCompleted ?? 0}</p>
                        <p className="text-muted-foreground">{t("admin.workers.jobs")}</p>
                      </div>
                      <div>
                        <p className="font-semibold">{(w.documents || []).length}</p>
                        <p className="text-muted-foreground">{t("admin.workers.docs")}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t("admin.workers.joined", { date: fmtDate(w.createdAt) })}</span>
                      <Button size="sm" variant="outline" onClick={() => { setDialogError(""); setSelectedId(w._id); }}>
                        <FileSearch className="mr-1.5 h-3.5 w-3.5" /> {t("admin.workers.review")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {data && data.items.length > 0 && (
          <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} busy={loading} />
        )}

        {/* detail dialog */}
        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
          <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
            {selected && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={selected.user.avatarFileId ? fileUrl(selected.user.avatarFileId) : ""}
                        alt={selected.user.name}
                      />
                      <AvatarFallback>{initials(selected.user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 text-left">
                      <DialogTitle className="flex flex-wrap items-center gap-2">
                        {selected.user.name}
                        <StatusPill status={selected.status} />
                        {selected.featured && (
                          <Badge className="border-transparent bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">{t("admin.workers.featured")}</Badge>
                        )}
                      </DialogTitle>
                      <DialogDescription>
                        {selected.profession} · {selected.user.email} · {selected.user.phone}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-5">
                  {selected.headline && <p className="text-sm font-medium">{selected.headline}</p>}
                  {selected.bio && <p className="whitespace-pre-line text-sm text-muted-foreground">{selected.bio}</p>}

                  {selected.statusNote && (
                    <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 p-3 text-sm text-amber-900 dark:text-amber-200">
                      <span className="font-medium">{t("admin.workers.statusNote")}</span> {selected.statusNote}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field label={t("admin.workers.experience")} value={t("admin.workers.years", { n: selected.yearsOfExperience ?? 0 })} />
                    <Field label={t("admin.workers.startingPrice")} value={selected.startingPrice ? etb(selected.startingPrice) : "—"} />
                    <Field label={t("admin.workers.responseTime")} value={t("admin.workers.minutes", { n: selected.responseTimeMinutes ?? "—" })} />
                    <Field
                      label={t("admin.workers.serviceArea")}
                      value={[
                        selected.serviceArea?.city,
                        selected.serviceArea?.woreda,
                        selected.serviceArea?.region,
                      ]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    />
                    <Field label={t("admin.workers.radius")} value={selected.serviceArea?.radiusKm ? t("admin.workers.km", { n: selected.serviceArea.radiusKm }) : "—"} />
                    <Field label={t("admin.workers.availability")} value={label(selected.availability)} />
                    <Field label={t("admin.workers.emergencyJobs")} value={selected.emergencyAvailable ? t("common.yes") : t("common.no")} />
                    <Field label={t("admin.workers.accountStatus")} value={label(selected.user.status)} />
                    <Field label={t("admin.workers.registered")} value={fmtDate(selected.user.createdAt)} />
                    <Field label={t("admin.workers.verifiedAt")} value={selected.verifiedAt ? fmtDateTime(selected.verifiedAt) : "—"} />
                  </div>

                  {selected.skills && selected.skills.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("admin.workers.skills")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.skills.map((s) => (
                          <Badge key={s} variant="secondary">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.languages && selected.languages.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("admin.workers.languages")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.languages.map((l) => (
                          <Badge key={l} variant="outline">
                            {l}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selected.schedule && selected.schedule.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {t("admin.workers.schedule")}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
                        {selected.schedule.map((s) => (
                          <div key={s.day} className="rounded-md border px-2 py-1.5">
                            <p className="font-medium uppercase">{label(s.day)}</p>
                            <p className="text-muted-foreground">
                              {s.closed ? t("admin.workers.closed") : `${s.open} – ${s.close}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* documents */}
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("admin.workers.documents", { n: (selected.documents || []).length })}
                    </p>
                    <div className="space-y-2">
                      {(selected.documents || []).length === 0 && (
                        <p className="text-sm text-muted-foreground">{t("admin.workers.noDocuments")}</p>
                      )}
                      {(selected.documents || []).map((doc) => (
                        <div key={doc._id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{doc.title}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${DOC_STATUS[doc.status] || ""}`}
                              >
                                {label(doc.status)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {label(doc.type)}
                              {doc.reviewedAt ? ` · ${t("admin.workers.reviewedAt", { date: fmtDateTime(doc.reviewedAt) })}` : ""}
                            </p>
                            {doc.reviewNote && (
                              <p className="text-xs italic text-muted-foreground">“{doc.reviewNote}”</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {doc.fileId && (
                              <Button asChild size="sm" variant="ghost">
                                <a href={fileUrl(doc.fileId)} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> {t("admin.view")}
                                </a>
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setDialogError("");
                                setDocNote("");
                                setDocAction({ doc, mode: "approved" });
                              }}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> {t("admin.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => {
                                setDialogError("");
                                setDocNote("");
                                setDocAction({ doc, mode: "rejected" });
                              }}
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" /> {t("admin.workers.reject")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <Button variant="ghost" onClick={() => setSelectedId(null)}>
                    {t("common.close")}
                  </Button>
                  {workerActionButtons(selected)}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* worker action dialog */}
        <Dialog open={!!workerAction} onOpenChange={(o) => !o && setWorkerAction(null)}>
          <DialogContent>
            {workerAction && (
              <>
                <DialogHeader>
                  <DialogTitle>{workerAction.title}</DialogTitle>
                  <DialogDescription>{workerAction.description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="worker-note">
                      {workerAction.requireNote ? t("admin.workers.noteRequired") : t("admin.workers.noteOptional")}
                    </Label>
                    <Textarea
                      id="worker-note"
                      rows={3}
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder={workerAction.requireNote ? t("admin.workers.rejectPlaceholder") : t("admin.workers.internalNote")}
                    />
                  </div>
                  {dialogError && <p className="text-sm text-red-600 dark:text-red-400">{dialogError}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setWorkerAction(null)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant={
                      workerAction.action === "reject" || workerAction.action === "suspend"
                        ? "destructive"
                        : "default"
                    }
                    disabled={busy || (workerAction.requireNote && !actionNote.trim())}
                    onClick={() => runWorkerAction(workerAction.action, actionNote.trim())}
                  >
                    {busy ? t("admin.working") : t("common.confirm")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* document review dialog */}
        <Dialog open={!!docAction} onOpenChange={(o) => !o && setDocAction(null)}>
          <DialogContent>
            {docAction && (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {docAction.mode === "approved" ? t("admin.workers.approveDoc") : t("admin.workers.rejectDoc")}
                  </DialogTitle>
                  <DialogDescription>{docAction.doc.title}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  {docAction.doc.fileId && (
                    <a href={fileUrl(docAction.doc.fileId)} target="_blank" rel="noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fileUrl(docAction.doc.fileId)}
                        alt={docAction.doc.title}
                        loading="lazy"
                        decoding="async"
                        className="max-h-56 w-full rounded-md border object-contain bg-muted"
                      />
                    </a>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="doc-note">
                      {docAction.mode === "rejected" ? t("admin.workers.noteRequired") : t("admin.workers.noteOptional")}
                    </Label>
                    <Textarea
                      id="doc-note"
                      rows={2}
                      value={docNote}
                      onChange={(e) => setDocNote(e.target.value)}
                      placeholder={docAction.mode === "rejected" ? t("admin.workers.docRejectPlaceholder") : t("admin.workers.reviewNote")}
                    />
                  </div>
                  {dialogError && <p className="text-sm text-red-600 dark:text-red-400">{dialogError}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDocAction(null)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant={docAction.mode === "rejected" ? "destructive" : "default"}
                    disabled={busy || (docAction.mode === "rejected" && !docNote.trim())}
                    onClick={runDocAction}
                  >
                    {busy ? t("admin.working") : t("common.confirm")}
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

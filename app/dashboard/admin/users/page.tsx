"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Eye,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UserCog,
  Users as UsersIcon,
} from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, fileUrl, fmtDate, fmtDateTime, timeAgo } from "@/lib/client";
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

interface WorkerProfileSummary {
  _id: string;
  profession: string;
  status: string;
  headline?: string;
  featured?: boolean;
  stats?: { jobsCompleted: number; ratingCount: number; ratingSum: number };
}

interface UserItem {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  gender?: string;
  createdAt: string;
  lastLoginAt?: string | null;
  avatarFileId?: string | null;
  failedPaymentProofs?: number;
  cancelledBookings?: number;
  workerProfile?: WorkerProfileSummary | null;
}

interface UsersResp {
  items: UserItem[];
  total: number;
  pages: number;
  counts: { _id: { role: string; status: string }; n: number }[];
}

interface ReviewItem {
  _id: string;
  overall: number;
  quality?: number;
  communication?: number;
  punctuality?: number;
  professionalism?: number;
  text: string;
  status: string;
  createdAt: string;
  workerReply?: string;
  customerId: { _id: string; name: string; avatarFileId?: string | null } | string;
  workerId: { _id: string; name: string } | string;
}

interface ReviewsResp {
  items: ReviewItem[];
  total: number;
  pages: number;
  summary: { avg?: number; n?: number } | null;
}

const ROLES = ["customer", "worker", "admin"];
const USER_STATUSES = ["active", "disabled", "suspended"];

function nameOf(v: ReviewItem["customerId"]): string {
  return typeof v === "object" && v ? v.name : "—";
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= Math.round(n) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{n.toFixed ? n.toFixed(1) : n}</span>
    </span>
  );
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const { t } = useLocale();
  const label = useStatusLabel();
  const [tab, setTab] = useState<"users" | "reviews">("users");

  // users state
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // reviews state
  const [revPage, setRevPage] = useState(1);
  const [reviews, setReviews] = useState<ReviewsResp | null>(null);
  const [revLoading, setRevLoading] = useState(false);
  const [revError, setRevError] = useState("");

  // dialogs
  const [viewUser, setViewUser] = useState<UserItem | null>(null);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState("");
  const [statusUser, setStatusUser] = useState<UserItem | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [deleteUser, setDeleteUser] = useState<UserItem | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState("");

  const [reviewTarget, setReviewTarget] = useState<{ review: ReviewItem; next: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api<UsersResp>(`/api/admin/users${qs({ role, status, q, page, limit: 15 })}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t("admin.errors.loadUsers"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, status, q, page]);

  useEffect(() => {
    if (tab !== "reviews") return;
    let cancelled = false;
    setRevLoading(true);
    setRevError("");
    api<ReviewsResp>(`/api/reviews${qs({ page: revPage, limit: 15 })}`)
      .then((d) => {
        if (!cancelled) setReviews(d);
      })
      .catch((e) => {
        if (!cancelled) setRevError(e instanceof Error ? e.message : t("admin.errors.loadReviews"));
      })
      .finally(() => {
        if (!cancelled) setRevLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, revPage]);

  const reloadUsers = () => {
    setLoading(true);
    setError("");
    api<UsersResp>(`/api/admin/users${qs({ role, status, q, page, limit: 15 })}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("admin.errors.loadUsers")))
      .finally(() => setLoading(false));
  };

  const reloadReviews = () => {
    setRevLoading(true);
    setRevError("");
    api<ReviewsResp>(`/api/reviews${qs({ page: revPage, limit: 15 })}`)
      .then(setReviews)
      .catch((e) => setRevError(e instanceof Error ? e.message : t("admin.errors.loadReviews")))
      .finally(() => setRevLoading(false));
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  };

  const patchUser = async (body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setDialogError("");
    try {
      await api("/api/admin/users", { method: "PATCH", body });
      toast({ title: success });
      setEditUser(null);
      setStatusUser(null);
      setNewStatus("");
      setStatusNote("");
      reloadUsers();
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.updateFailed");
      setDialogError(msg);
      toast({ title: t("admin.errors.updateFailed"), description: msg, variant: "destructive" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteUser) return;
    setBusy(true);
    setDeleteError("");
    try {
      await api("/api/admin/users", { method: "DELETE", body: { id: deleteUser._id } });
      toast({ title: t("admin.users.userDeleted"), description: deleteUser.email });
      setDeleteUser(null);
      reloadUsers();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.deleteFailed");
      setDeleteError(msg);
      toast({ title: t("admin.errors.deleteFailed"), description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const moderateReview = async () => {
    if (!reviewTarget) return;
    setBusy(true);
    try {
      await api("/api/reviews", { method: "PATCH", body: { id: reviewTarget.review._id, status: reviewTarget.next } });
      toast({
        title: t("admin.users.reviewUpdated"),
        description: t("admin.users.reviewStatusNow", { status: label(reviewTarget.next) }),
      });
      setReviewTarget(null);
      reloadReviews();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("admin.errors.updateFailed");
      toast({ title: t("admin.errors.updateFailed"), description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const countFor = (r: string, s: string) =>
    data?.counts.find((c) => c._id.role === r && c._id.status === s)?.n || 0;

  return (
    <DashboardShell role="admin" nav={ADMIN_NAV} title={t("nav.users")} subtitle={t("admin.users.subtitle")}>
      <div className="max-w-7xl space-y-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "users" | "reviews")}>
          <TabsList>
            <TabsTrigger value="users">{t("nav.users")}</TabsTrigger>
            <TabsTrigger value="reviews">{t("admin.users.tabReviews")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "users" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <Select
                  value={role || "all"}
                  onValueChange={(v) => {
                    setRole(v === "all" ? "" : v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder={t("common.role")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.users.allRoles")}</SelectItem>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {label(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={status || "all"}
                  onValueChange={(v) => {
                    setStatus(v === "all" ? "" : v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder={t("common.status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("admin.allStatuses")}</SelectItem>
                    {USER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {label(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="self-center text-sm text-muted-foreground">
                  {data ? t("admin.users.count", { n: data.total }) : ""}
                </span>
              </div>

              <form onSubmit={onSearch} className="flex gap-2">
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("admin.users.searchPlaceholder")}
                  className="w-full lg:w-72"
                />
                <Button type="submit" variant="outline">
                  <Search className="mr-1.5 h-4 w-4" /> {t("common.search")}
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={reloadUsers} aria-label={t("common.refresh")}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </form>
            </div>

            {error && <ErrorAlert error={error} onRetry={reloadUsers} />}

            {loading && !data ? (
              <ListSkeleton rows={8} />
            ) : !data || data.items.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title={q ? t("admin.users.emptySearchTitle") : t("admin.users.emptyTitle")}
                desc={q ? t("admin.nothingFound", { q }) : t("admin.users.emptyDesc")}
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("common.name")}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("common.email")}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("common.phone")}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("common.role")}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("common.status")}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("admin.users.registered")}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("admin.users.lastLogin")}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t("admin.users.failedProofs")}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.items.map((u) => (
                      <tr key={u._id} className="transition-colors hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={u.avatarFileId ? fileUrl(u.avatarFileId) : ""} alt={u.name} />
                              <AvatarFallback className="text-[10px]">{initials(u.name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{u.phone}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="capitalize">
                            {label(u.role)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={u.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(u.createdAt)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {u.lastLoginAt ? timeAgo(u.lastLoginAt) : t("admin.never")}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm font-semibold ${(u.failedPaymentProofs || 0) > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
                          >
                            {u.failedPaymentProofs || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <UserCog className="mr-1.5 h-4 w-4" /> {t("admin.users.manage")}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel>{u.name}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setDialogError("");
                                  setViewUser(u);
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" /> {t("common.viewDetails")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setDialogError("");
                                  setEditName(u.name);
                                  setEditUser(u);
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" /> {t("admin.users.editName")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setDialogError("");
                                  setNewStatus(u.status);
                                  setStatusNote("");
                                  setStatusUser(u);
                                }}
                              >
                                <ShieldCheck className="mr-2 h-4 w-4" /> {t("admin.users.changeStatus")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 dark:text-red-400 focus:text-red-600"
                                onClick={() => {
                                  setDeleteError("");
                                  setDeleteUser(u);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> {t("admin.users.deleteUser")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data && data.items.length > 0 && (
              <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} busy={loading} />
            )}

            {data && (
              <p className="text-xs text-muted-foreground">
                {t("admin.users.totals", {
                  customers: countFor("customer", "active") + countFor("customer", "disabled") + countFor("customer", "suspended"),
                  workers: countFor("worker", "active") + countFor("worker", "disabled") + countFor("worker", "suspended"),
                  admins: countFor("admin", "active") + countFor("admin", "disabled") + countFor("admin", "suspended"),
                })}
              </p>
            )}
          </div>
        )}

        {tab === "reviews" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                {reviews?.summary?.n
                  ? t("admin.users.reviewsSummary", {
                      n: reviews.summary.n,
                      avg: Number(reviews.summary.avg || 0).toFixed(2),
                    })
                  : t("admin.users.moderateReviews")}
              </div>
              <Button variant="outline" size="sm" onClick={reloadReviews}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {t("common.refresh")}
              </Button>
            </div>

            {revError && <ErrorAlert error={revError} onRetry={reloadReviews} />}

            {revLoading && !reviews ? (
              <ListSkeleton rows={6} />
            ) : !reviews || reviews.items.length === 0 ? (
              <EmptyState icon={Star} title={t("admin.users.noReviews")} desc={t("admin.users.noReviewsDesc")} />
            ) : (
              <div className="space-y-3">
                {reviews.items.map((r) => (
                  <Card key={r._id}>
                    <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Stars n={r.overall} />
                          <StatusPill status={r.status} />
                          <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                        </div>
                        <p className="text-sm font-medium">
                          {nameOf(r.workerId)} <span className="font-normal text-muted-foreground">{t("admin.users.forLabel")}</span>{" "}
                          {nameOf(r.customerId)}
                        </p>
                        {r.text && <p className="text-sm text-muted-foreground">“{r.text}”</p>}
                        <p className="text-xs text-muted-foreground">
                          {t("admin.users.quality")} {r.quality ?? "—"} · {t("admin.users.communication")}{" "}
                          {r.communication ?? "—"} · {t("admin.users.punctuality")} {r.punctuality ?? "—"} ·{" "}
                          {t("admin.users.professionalism")} {r.professionalism ?? "—"}
                        </p>
                        {r.workerReply && (
                          <p className="text-xs italic text-muted-foreground">
                            {t("admin.users.workerReply", { text: r.workerReply })}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {r.status !== "hidden" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewTarget({ review: r, next: "hidden" })}
                          >
                            {t("admin.users.hide")}
                          </Button>
                        )}
                        {r.status !== "visible" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewTarget({ review: r, next: "visible" })}
                          >
                            {t("admin.users.restore")}
                          </Button>
                        )}
                        {r.status !== "removed" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setReviewTarget({ review: r, next: "removed" })}
                          >
                            {t("common.remove")}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Pagination page={revPage} pages={reviews.pages} total={reviews.total} onPage={setRevPage} busy={revLoading} />
              </div>
            )}
          </div>
        )}

        {/* view dialog */}
        <Dialog open={!!viewUser} onOpenChange={(o) => !o && setViewUser(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            {viewUser && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {viewUser.name} <StatusPill status={viewUser.status} />
                  </DialogTitle>
                  <DialogDescription>{viewUser.email}</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("admin.users.userId")} value={viewUser._id} />
                  <Field label={t("common.role")} value={<Badge variant="secondary" className="capitalize">{label(viewUser.role)}</Badge>} />
                  <Field label={t("common.phone")} value={viewUser.phone} />
                  <Field label={t("admin.users.gender")} value={label(viewUser.gender || "")} />
                  <Field label={t("admin.users.registered")} value={fmtDateTime(viewUser.createdAt)} />
                  <Field
                    label={t("admin.users.lastLogin")}
                    value={viewUser.lastLoginAt ? fmtDateTime(viewUser.lastLoginAt) : t("admin.never")}
                  />
                  <Field label={t("admin.users.failedPaymentProofs")} value={viewUser.failedPaymentProofs || 0} />
                  <Field label={t("admin.users.cancelledBookings")} value={viewUser.cancelledBookings || 0} />
                </div>
                {viewUser.workerProfile && (
                  <div className="rounded-md border p-3">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("admin.users.workerProfile")}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={t("admin.users.profession")} value={viewUser.workerProfile.profession} />
                      <Field label={t("admin.users.verification")} value={<StatusPill status={viewUser.workerProfile.status} />} />
                      <Field label={t("admin.users.featured")} value={viewUser.workerProfile.featured ? t("common.yes") : t("common.no")} />
                      <Field
                        label={t("admin.users.jobsCompleted")}
                        value={viewUser.workerProfile.stats?.jobsCompleted ?? 0}
                      />
                      <Field
                        label={t("admin.users.rating")}
                        value={
                          viewUser.workerProfile.stats && viewUser.workerProfile.stats.ratingCount > 0
                            ? (
                                viewUser.workerProfile.stats.ratingSum / viewUser.workerProfile.stats.ratingCount
                              ).toFixed(1)
                            : "—"
                        }
                      />
                      <Field label={t("admin.users.headline")} value={viewUser.workerProfile.headline} className="col-span-2" />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setViewUser(null)}>
                    {t("common.close")}
                  </Button>
                  <Button
                    onClick={() => {
                      setDialogError("");
                      setEditName(viewUser.name);
                      setEditUser(viewUser);
                      setViewUser(null);
                    }}
                  >
                    {t("admin.users.editName")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* edit name dialog */}
        <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
          <DialogContent>
            {editUser && (
              <>
                <DialogHeader>
                  <DialogTitle>{t("admin.users.editName")}</DialogTitle>
                  <DialogDescription>{editUser.email}</DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-name">{t("admin.users.fullName")}</Label>
                  <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                {dialogError && <p className="text-sm text-red-600 dark:text-red-400">{dialogError}</p>}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditUser(null)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    disabled={busy || editName.trim().length < 2}
                    onClick={() => patchUser({ id: editUser._id, name: editName.trim() }, t("admin.users.nameUpdated"))}
                  >
                    {busy ? t("admin.saving") : t("common.save")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* change status dialog */}
        <Dialog open={!!statusUser} onOpenChange={(o) => !o && setStatusUser(null)}>
          <DialogContent>
            {statusUser && (
              <>
                <DialogHeader>
                  <DialogTitle>{t("admin.users.changeAccountStatus")}</DialogTitle>
                  <DialogDescription>
                    {t("admin.users.currentlyStatus", {
                      name: statusUser.name,
                      status: label(statusUser.status),
                    })}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-status">{t("admin.users.newStatus")}</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger id="new-status">
                        <SelectValue placeholder={t("admin.users.selectStatus")} />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {label(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="status-note">{t("admin.users.statusNoteLabel")}</Label>
                    <Textarea
                      id="status-note"
                      rows={2}
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder={t("admin.users.statusNotePlaceholder")}
                    />
                  </div>
                  {dialogError && <p className="text-sm text-red-600 dark:text-red-400">{dialogError}</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStatusUser(null)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    disabled={busy || !newStatus || newStatus === statusUser.status}
                    onClick={() =>
                      patchUser({ id: statusUser._id, status: newStatus, note: statusNote }, t("admin.users.statusUpdated"))
                    }
                  >
                    {busy ? t("admin.saving") : t("admin.users.applyStatus")}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* delete confirmation */}
        <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("admin.users.deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("admin.users.deleteDesc", { email: deleteUser?.email || "" })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError && (
              <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/60 p-3 text-sm text-red-700 dark:text-red-300">{deleteError}</div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction disabled={busy} onClick={confirmDelete}>
                {busy ? t("admin.users.deleting") : t("admin.users.deleteUser")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* review moderation confirmation */}
        <AlertDialog open={!!reviewTarget} onOpenChange={(o) => !o && setReviewTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {reviewTarget?.next === "hidden"
                  ? t("admin.users.hideReviewTitle")
                  : reviewTarget?.next === "removed"
                    ? t("admin.users.removeReviewTitle")
                    : t("admin.users.restoreReviewTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {reviewTarget?.next === "removed"
                  ? t("admin.users.removeReviewDesc")
                  : reviewTarget?.next === "hidden"
                    ? t("admin.users.hideReviewDesc")
                    : t("admin.users.restoreReviewDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction disabled={busy} onClick={moderateReview}>
                {busy ? t("admin.working") : t("common.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardShell>
  );
}

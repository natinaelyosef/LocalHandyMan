"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Images, MapPin, MessageSquare, TriangleAlert, Zap } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { WORKER_NAV } from "@/components/dashboard/nav-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { api, etb, fmtDate, timeAgo, URGENCY_CLASS } from "@/lib/client";
import { useLocale } from "@/context/locale";
import { EmptyState, ErrorState, readQuoted, useErrMsg, type CategoryT, type RequestItemT } from "../_shared";

const ALL = "__all__";

export default function WorkerRequestsPage() {
  const { t } = useLocale();
  const errMsg = useErrMsg();
  const [categories, setCategories] = useState<CategoryT[]>([]);
  const [category, setCategory] = useState(ALL);
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<RequestItemT[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quoted, setQuoted] = useState<Record<string, { total: number; at: number }>>({});

  useEffect(() => {
    setQuoted(readQuoted());
    api<{ tree: CategoryT[] }>("/api/categories")
      .then((d) => setCategories(d.tree || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams();
      sp.set("view", "available");
      sp.set("page", String(page));
      sp.set("limit", "10");
      if (category !== ALL) sp.set("category", category);
      if (emergencyOnly) sp.set("emergency", "1");
      const d = await api<{ items: RequestItemT[]; total: number; pages: number }>(`/api/requests?${sp.toString()}`);
      setItems(d.items || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
      setQuoted(readQuoted());
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [errMsg, category, emergencyOnly, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardShell role="worker" nav={WORKER_NAV} title={t("nav.jobRequests")} subtitle={t("worker.requests.subtitle")}>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-xs">
            <Label className="mb-1.5 block">{t("common.category")}</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setPage(1);
              }}
            >
              <SelectTrigger>
              <SelectValue placeholder={t("worker.requests.allCategories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("worker.requests.allCategories")}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 sm:w-auto">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-red-500 dark:text-red-400" /> {t("worker.requests.emergencyOnly")}
            </span>
            <Switch
              checked={emergencyOnly}
              onCheckedChange={(v) => {
                setEmergencyOnly(v);
                setPage(1);
              }}
            />
          </div>

          <div className="ml-auto text-sm text-muted-foreground">
            {loading
              ? t("common.loading")
              : total === 1
                ? t("worker.requests.availableOne")
                : t("worker.requests.availableMany", { count: total })}
          </div>
        </div>

        {loading && (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        )}

        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title={t("worker.requests.emptyTitle")}
            hint={t("worker.requests.emptyHint")}
            action={
              <div className="flex gap-2">
                {category !== ALL && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCategory(ALL);
                      setPage(1);
                    }}
                  >
                    {t("worker.requests.clearCategory")}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => load()}>
                  {t("common.refresh")}
                </Button>
              </div>
            }
          />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((r) => {
              const q = quoted[r._id];
              return (
                <Card key={r._id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={URGENCY_CLASS[r.urgency] || URGENCY_CLASS.normal} variant="secondary">
                        {r.urgency === "emergency" && <TriangleAlert className="mr-1 h-3 w-3" />}
                        {t(`common.urgency.${r.urgency}`)}
                      </Badge>
                      <Badge variant="outline" className="text-muted-foreground">
                        {r.categoryId?.icon ? `${r.categoryId.icon} ` : ""}
                        {r.categoryId?.name || t("worker.requests.serviceFallback")}
                      </Badge>
                      {q && (
                        <Badge className="bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
                          {t("worker.requests.youQuoted", { amount: etb(q.total) })}
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                    </div>

                    <div>
                      <h3 className="line-clamp-1 font-semibold">{r.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="truncate">👤 {r.customerId?.name || t("worker.customer")}</span>
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {[r.location?.city, r.location?.woreda, r.location?.area].filter(Boolean).join(" · ") || "—"}
                      </span>
                      <span>
                        {r.budget > 0 ? t("worker.requests.budget", { amount: etb(r.budget) }) : t("worker.budgetNotSet")}
                      </span>
                      <span className="flex items-center gap-1">
                        {r.preferredDate
                          ? t("worker.requests.preferredDate", { date: fmtDate(r.preferredDate) })
                          : t("worker.requests.noPreferredDate")}
                      </span>
                      <span className="flex items-center gap-1">
                        {r.mediaFileIds && r.mediaFileIds.length > 0 && (
                          <>
                            <Images className="h-3.5 w-3.5" />{" "}
                            {r.mediaFileIds.length === 1
                              ? t("worker.requests.photoOne")
                              : t("worker.requests.photoMany", { count: r.mediaFileIds.length })}
                          </>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {(r.quotationCount || 0) === 1
                          ? t("worker.requests.quoteOne")
                          : t("worker.requests.quoteMany", { count: r.quotationCount || 0 })}
                      </span>
                      <span className="text-right">{t(`worker.reqStatus.${r.status}`)}</span>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t("worker.requests.ref", { ref: r.reference })}
                      </span>
                      <Button asChild size="sm">
                        <Link href={`/dashboard/worker/requests/${r._id}`}>
                          {q || r.status !== "open" ? t("common.viewDetails") : t("worker.requests.viewAccept")}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!loading && !error && pages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              {t("worker.previous")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("worker.pageOf", { page, pages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              {t("common.next")}
            </Button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Eye, Loader2, MapPin, PlusCircle, XCircle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, fmtDate, timeAgo } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import type { Quotation, ServiceRequest } from "@/app/dashboard/customer/_lib/types";
import { rname } from "@/app/dashboard/customer/_lib/types";
import {
  EmptyState,
  ErrorState,
  FieldError,
  RowsSkeleton,
  StatusBadge,
  UrgencyBadge,
  errText,
} from "@/app/dashboard/customer/_lib/ui";

type TabKey = "all" | "open" | "quoted" | "booking_created" | "closed";

const TABS: { key: TabKey; labelKey: string }[] = [
  { key: "all", labelKey: "common.all" },
  { key: "open", labelKey: "common.status.open" },
  { key: "quoted", labelKey: "customer.requests.tabQuoted" },
  { key: "booking_created", labelKey: "customer.status.booking_created" },
  { key: "closed", labelKey: "customer.status.closed" },
];

const LIMIT = 10;

export default function MyRequestsPage() {
  const { toast } = useToast();
  const { t } = useLocale();
  const [tab, setTab] = useState<TabKey>("all");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<ServiceRequest[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [cancelTarget, setCancelTarget] = useState<ServiceRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelErr, setCancelErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let list: ServiceRequest[] = [];
      let nextPages = 1;
      let nextTotal = 0;
      if (tab === "closed") {
        const [c, e] = await Promise.all([
          api<{ items: ServiceRequest[]; total: number; pages: number }>(
            `/api/requests?view=mine&status=cancelled&page=${page}&limit=${LIMIT}`
          ),
          api<{ items: ServiceRequest[]; total: number; pages: number }>(
            `/api/requests?view=mine&status=expired&page=${page}&limit=${LIMIT}`
          ),
        ]);
        list = [...(c.items || []), ...(e.items || [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        nextPages = Math.max(c.pages || 1, e.pages || 1);
        nextTotal = (c.total || 0) + (e.total || 0);
      } else {
        const sp = new URLSearchParams({ view: "mine", page: String(page), limit: String(LIMIT) });
        if (tab !== "all") sp.set("status", tab);
        const d = await api<{ items: ServiceRequest[]; total: number; pages: number }>(
          `/api/requests?${sp.toString()}`
        );
        list = d.items || [];
        nextPages = d.pages || 1;
        nextTotal = d.total || 0;
      }
      setItems(list);
      setPages(nextPages);
      setTotal(nextTotal);

      const quoted = list.filter((i) => i.status === "quoted");
      if (quoted.length) {
        const pairs = await Promise.all(
          quoted.map(async (i) => {
            try {
              const d = await api<{ quotations: Quotation[] }>(`/api/requests/${i._id}`);
              return [i._id, (d.quotations || []).length] as const;
            } catch {
              return [i._id, 0] as const;
            }
          })
        );
        setCounts(Object.fromEntries(pairs));
      }
    } catch (e) {
      setError(errText(e, t));
    } finally {
      setLoading(false);
    }
  }, [tab, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const changeTab = (v: string) => {
    setTab(v as TabKey);
    setPage(1);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 3) {
      setCancelErr(t("customer.requests.cancelReasonError"));
      return;
    }
    setBusy(true);
    setCancelErr("");
    try {
      await api(`/api/requests/${cancelTarget._id}`, {
        method: "PATCH",
        body: { action: "cancel", reason: cancelReason.trim() },
      });
      toast({ title: t("customer.requests.cancelledToast"), description: t("customer.requests.cancelledToastDesc") });
      setCancelTarget(null);
      setCancelReason("");
      await load();
    } catch (e) {
      setCancelErr(errText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell
      role="customer"
      nav={CUSTOMER_NAV}
      title={t("nav.myRequests")}
      subtitle={
        total ? t("customer.requests.subtitleCount", { n: total }) : t("customer.requests.subtitle")
      }
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("customer.requests.heading")}</h2>
            <p className="text-sm text-muted-foreground">{t("customer.requests.headingHint")}</p>
          </div>
          <Button asChild>
            <Link href="/dashboard/customer/requests/new">
              <PlusCircle className="mr-2 h-4 w-4" /> {t("nav.newRequest")}
            </Link>
          </Button>
        </div>

        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
            {TABS.map((tabItem) => (
              <TabsTrigger key={tabItem.key} value={tabItem.key} className="text-sm">
                {t(tabItem.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={tab} className="mt-4 space-y-4">
            {loading && <RowsSkeleton n={4} />}
            {!loading && error && <ErrorState message={error} onRetry={load} />}
            {!loading && !error && items.length === 0 && (
              <EmptyState
                icon={ClipboardList}
                title={tab === "all" ? t("customer.requests.emptyAllTitle") : t("customer.requests.emptyTabTitle")}
                message={
                  tab === "all" ? t("customer.requests.emptyAllMsg") : t("customer.requests.emptyTabMsg")
                }
              >
                <Button asChild>
                  <Link href="/dashboard/customer/requests/new">
                    <PlusCircle className="mr-2 h-4 w-4" /> {t("nav.newRequest")}
                  </Link>
                </Button>
              </EmptyState>
            )}

            {!loading && !error && items.length > 0 && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {items.map((r) => (
                    <div key={r._id} className="flex flex-col rounded-xl border bg-card p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {r.reference}
                        </Badge>
                        <StatusBadge status={r.status} />
                        <UrgencyBadge urgency={r.urgency} />
                        <span className="ml-auto text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                      </div>

                      <Link
                        href={`/dashboard/customer/requests/${r._id}`}
                        className="mt-3 line-clamp-2 text-base font-semibold hover:underline"
                      >
                        {r.title}
                      </Link>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{rname(r.categoryId, t("customer.serviceFallback"))}</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {[r.location?.city, r.location?.region].filter(Boolean).join(", ") || "—"}
                        </span>
                        <span>{fmtDate(r.createdAt)}</span>
                        {r.status === "quoted" && (
                          <Badge className="bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300" variant="secondary">
                            {counts[r._id] === undefined
                              ? "…"
                              : counts[r._id] === 1
                                ? t("customer.requests.quotationOne", { n: counts[r._id] })
                                : t("customer.requests.quotationMany", { n: counts[r._id] })}
                          </Badge>
                        )}
                        {r.budget ? <span>{t("customer.budgetFmt", { n: r.budget.toLocaleString() })}</span> : null}
                      </div>

                      <div className="mt-4 flex items-center gap-2 border-t pt-3">
                        <Button asChild size="sm" variant="outline" className="ml-auto">
                          <Link href={`/dashboard/customer/requests/${r._id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            {r.status === "quoted" ? t("customer.viewQuotations") : t("common.viewDetails")}
                          </Link>
                        </Button>
                        {(r.status === "open" || r.status === "quoted") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 dark:text-red-400 hover:text-red-700"
                            onClick={() => {
                              setCancelTarget(r);
                              setCancelReason("");
                              setCancelErr("");
                            }}
                          >
                            <XCircle className="mr-2 h-4 w-4" /> {t("common.cancel")}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {pages > 1 && (
                  <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      {t("customer.previous")}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {t("customer.pageOf", { page, pages })}
                    </span>
                    <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                      {t("common.next")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("customer.requests.cancelTitle", { ref: cancelTarget?.reference || "" })}</DialogTitle>
            <DialogDescription>{t("customer.requests.cancelDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">{t("customer.requests.cancelReasonLabel")}</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              placeholder={t("customer.requests.cancelReasonPlaceholder")}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <FieldError msg={cancelErr} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={busy}>
              {t("customer.requests.keepRequest")}
            </Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("customer.requests.cancelConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

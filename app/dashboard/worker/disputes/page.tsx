"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw, Scale, Search } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { WORKER_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DisputePriorityBadge,
  DisputeStatusBadge,
  type DisputeT,
} from "@/components/dashboard/disputes-ui";
import { api, timeAgo } from "@/lib/client";
import { useLocale } from "@/context/locale";
import { EmptyState, ErrorState, useErrMsg } from "../_shared";

type ListResp = {
  items: DisputeT[];
  total: number;
  page: number;
  pages: number;
  openCount: number;
};

export default function WorkerDisputesPage() {
  const { t } = useLocale();
  const errMsg = useErrMsg();
  const [tab, setTab] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Read the deep-linked filter from the URL in an effect rather than
  // useSearchParams, which would force this page out of static prerendering.
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    setTab(s === "all" ? "all" : "open");
  }, []);

  const load = useCallback(() => {
    if (tab === null) return;
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ status: tab, page: String(page), limit: "10" });
    if (q) qs.set("q", q);
    api<ListResp>(`/api/disputes?${qs.toString()}`)
      .then(setData)
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardShell
      role="worker"
      nav={WORKER_NAV}
      title={t("common.dispute.title")}
      subtitle={t("common.dispute.subtitle")}
    >
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {["open", "all"].map((v) => (
              <Button
                key={v}
                variant={tab === v ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setTab(v);
                  setPage(1);
                }}
              >
                {v === "open" ? t("admin.disputes.filterOpen") : t("admin.disputes.filterAll")}
                {v === "open" && (data?.openCount || 0) > 0 && (
                  <span className="ml-2 rounded-full bg-red-500 px-1.5 text-xs text-white">
                    {data?.openCount}
                  </span>
                )}
              </Button>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQ(searchInput.trim());
            }}
          >
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("admin.disputes.searchPlaceholder")}
              className="w-full sm:w-64"
            />
            <Button type="submit" variant="outline" size="sm">
              <Search className="mr-1.5 h-4 w-4" /> {t("common.search")}
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={load} aria-label={t("common.refresh")}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {error && <ErrorState message={error} onRetry={load} />}

        {loading && !data ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/30" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={Scale}
            title={q ? t("common.dispute.emptySearchTitle") : t("common.dispute.emptyTitle")}
            hint={q ? t("common.dispute.emptySearchDesc", { q }) : t("common.dispute.emptyDesc")}
          />
        ) : (
          <div className="space-y-3">
            {data.items.map((d) => {
              const booking = d.bookingId as { _id: string; code: string };
              return (
                <Link
                  key={d._id}
                  href={`/dashboard/worker/disputes/${d._id}`}
                  className="block rounded-xl border bg-card p-4 transition hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{d.code}</span>
                    <DisputeStatusBadge status={d.status} />
                    <DisputePriorityBadge priority={d.priority} />
                    <span className="ml-auto text-xs text-muted-foreground">
                      {timeAgo(d.lastMessageAt || d.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 font-medium">{d.subject}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.description}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{t("common.dispute.openedBy", { name: d.raisedBy?.name || "" })}</span>
                    <span>·</span>
                    <span>{t("common.dispute.onBooking", { code: booking?.code || "" })}</span>
                    <ArrowRight className="ml-auto h-3.5 w-3.5" />
                  </p>
                </Link>
              );
            })}

            {data.pages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("admin.pagination.prev")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {t("admin.pagination.pageOf", {
                    page: data.page,
                    pages: data.pages,
                    total: data.total,
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("common.next")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

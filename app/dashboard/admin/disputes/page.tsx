"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw, Scale, Search, UserCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DisputePriorityBadge,
  DisputeStatusBadge,
  type DisputeT,
} from "@/components/dashboard/disputes-ui";
import { api, timeAgo } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { EmptyState, ErrorAlert, ListSkeleton, Pagination, qs } from "../_shared";

type ListResp = {
  items: DisputeT[];
  total: number;
  page: number;
  pages: number;
  openCount: number;
  statusCounts: Record<string, number>;
};

export default function AdminDisputesPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const [tab, setTab] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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
    api<ListResp>(`/api/disputes${qs({ status: tab, q, page, limit: 10 })}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("common.error")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, q]);

  useEffect(() => {
    load();
  }, [load]);

  const assignToMe = async (d: DisputeT) => {
    setBusyId(d._id);
    try {
      await api(`/api/disputes/${d._id}`, { body: { action: "assign", assignedToId: "me" } });
      toast({ title: t("admin.disputes.assigned"), description: d.code });
      load();
    } catch (e) {
      toast({
        title: t("common.error"),
        description: e instanceof Error ? e.message : t("common.retry"),
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardShell
      role="admin"
      nav={ADMIN_NAV}
      title={t("common.dispute.title")}
      subtitle={t("admin.disputes.subtitle")}
    >
      <div className="max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
                <span className="ml-2 rounded-full bg-muted px-1.5 text-xs">
                  {v === "open" ? data?.openCount || 0 : data?.total || 0}
                </span>
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
              className="w-full lg:w-72"
            />
            <Button type="submit" variant="outline">
              <Search className="mr-1.5 h-4 w-4" /> {t("common.search")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={load}
              aria-label={t("common.refresh")}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {error && <ErrorAlert error={error} onRetry={load} />}

        {loading && !data ? (
          <ListSkeleton rows={5} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={Scale}
            title={q ? t("common.dispute.emptySearchTitle") : t("admin.disputes.emptyQueueTitle")}
            desc={q ? t("common.dispute.emptySearchDesc", { q }) : t("admin.disputes.emptyQueueDesc")}
          />
        ) : (
          <div className="space-y-3">
            {data.items.map((d) => {
              const booking = d.bookingId as { _id: string; code: string; title: string };
              const assigned = d.assignedTo as { name?: string } | null;
              return (
                <div key={d._id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{d.code}</span>
                    <DisputeStatusBadge status={d.status} />
                    <DisputePriorityBadge priority={d.priority} />
                    {!d.firstResponseAt && (
                      <Badge
                        variant="outline"
                        className="border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      >
                        {t("admin.disputes.responsePending")}
                      </Badge>
                    )}
                    {assigned?.name ? (
                      <span className="text-xs text-muted-foreground">
                        {t("admin.disputes.assignedTo")}: {assigned.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("admin.disputes.unassigned")}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {timeAgo(d.lastMessageAt || d.createdAt)}
                    </span>
                  </div>

                  <p className="mt-1.5 font-medium">{d.subject}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.description}</p>

                  <div className="mt-2.5 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>
                      <span className="font-medium text-foreground">
                        {t("admin.disputes.raisedBy")}:
                      </span>{" "}
                      {d.raisedBy?.name} · {d.category}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">{t("admin.disputes.against")}:</span>{" "}
                      {d.againstUserId?.name}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        {t("admin.disputes.reportedBooking")}:
                      </span>{" "}
                      {booking?.code}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        {t("common.dispute.evidenceCount", { n: d.evidenceFileIds?.length || 0 })}
                      </span>
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === d._id}
                      onClick={() => assignToMe(d)}
                    >
                      <UserCheck className="mr-1.5 h-3.5 w-3.5" /> {t("admin.disputes.assignToMe")}
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="ml-auto">
                      <Link href={`/dashboard/admin/disputes/${d._id}`}>
                        {t("common.dispute.detail")} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
            <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} busy={loading} />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

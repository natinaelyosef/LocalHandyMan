"use client";

import { useEffect, useState, type FormEvent } from "react";
import { RefreshCw, ScrollText, Search } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, fmtDateTime } from "@/lib/client";
import { useLocale } from "@/context/locale";
import { EmptyState, ErrorAlert, Pagination, StatusPill, qs, useStatusLabel, type AuditItem } from "../_shared";

interface AuditResp {
  items: AuditItem[];
  total: number;
  pages: number;
  actions: string[];
}

const ALL = "all";

export default function AdminAuditPage() {
  const { t } = useLocale();
  const label = useStatusLabel();
  const [action, setAction] = useState(ALL);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api<AuditResp>(`/api/admin/audit${qs({ action: action === ALL ? "" : action, q, page, limit: 30 })}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t("admin.errors.loadAudit"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, q, page]);

  const reload = () => {
    setLoading(true);
    setError("");
    api<AuditResp>(`/api/admin/audit${qs({ action: action === ALL ? "" : action, q, page, limit: 30 })}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("admin.errors.loadAudit")))
      .finally(() => setLoading(false));
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  };

  const actions = data?.actions || [];

  return (
    <DashboardShell
      role="admin"
      nav={ADMIN_NAV}
      title={t("nav.auditLog")}
      subtitle={t("admin.audit.subtitle")}
    >
      <div className="max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={action}
              onValueChange={(v) => {
                setAction(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder={t("admin.audit.filterByAction")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("admin.audit.allActions")}</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {label(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{data ? t("admin.audit.entries", { n: data.total }) : ""}</span>
          </div>

          <form onSubmit={onSearch} className="flex gap-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("admin.audit.searchPlaceholder")}
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
          <div className="space-y-2 rounded-lg border p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={q ? t("admin.audit.emptySearchTitle") : t("admin.audit.emptyTitle")}
            desc={q ? t("admin.nothingFound", { q }) : t("admin.audit.emptyDesc")}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.audit.time")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.audit.actor")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.audit.action")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.audit.entity")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.audit.summary")}</TableHead>
                  <TableHead className="text-sm font-medium text-muted-foreground">{t("admin.audit.meta")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(item.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      <span className="font-medium">{item.actorName || t("admin.actor.system")}</span>
                      <span className="block text-xs capitalize text-muted-foreground">
                        {item.actorRole ? label(item.actorRole) : t("admin.actor.system")}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <StatusPill status={item.action} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      <span className="font-medium">{item.entity || "—"}</span>
                      <span className="block max-w-[140px] truncate font-mono text-[11px] text-muted-foreground">
                        {item.entityId || ""}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-[240px] text-sm">{item.summary || "—"}</TableCell>
                    <TableCell>
                      {item.meta ? (
                        <details>
                          <summary className="cursor-pointer select-none text-xs text-primary">{t("admin.audit.viewMeta")}</summary>
                          <pre className="mt-1 max-w-xs overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-[11px]">
                            {JSON.stringify(item.meta, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.items.length > 0 && (
          <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} busy={loading} />
        )}
      </div>
    </DashboardShell>
  );
}

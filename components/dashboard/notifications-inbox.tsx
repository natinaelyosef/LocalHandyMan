"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  CheckCheck,
  Check,
  Inbox,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import type { NavItem } from "@/components/dashboard/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, timeAgo } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import type { Role } from "@/context/auth";

export type NotifItem = {
  _id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  category: string;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
};

type InboxResp = {
  items: NotifItem[];
  unread: number;
  total: number;
  page: number;
  pages: number;
  unreadByCategory: Record<string, number>;
};

const CATEGORY_ICON: Record<string, LucideIcon> = {
  booking: Bell,
  payment: CheckCheck,
  message: Inbox,
  review: Check,
  worker: Bell,
  system: Bell,
};

const TABS: { value: string; key: string }[] = [
  { value: "all", key: "common.all" },
  { value: "unread", key: "common.notificationsUnread" },
  { value: "booking", key: "nav.bookings" },
  { value: "payment", key: "nav.payments" },
  { value: "message", key: "nav.messages" },
  { value: "system", key: "nav.notifications" },
];

function inboxQuery(base: string, tab: string, page: number) {
  const qs = new URLSearchParams({ page: String(page), limit: "20" });
  if (tab === "unread") qs.set("unread", "1");
  else if (tab !== "all") qs.set("category", tab);
  return `${base}?${qs.toString()}`;
}

export function NotificationsInbox({
  role,
  nav,
}: {
  role: Role;
  nav: NavItem[];
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InboxResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api<InboxResp>(inboxQuery("/api/notifications", tab, page))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("common.error")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (body: Record<string, unknown>, successTitle?: string) => {
    setBusy(true);
    try {
      await api("/api/notifications", { body });
      if (successTitle) toast({ title: successTitle });
      load();
    } catch (e) {
      toast({
        title: t("common.error"),
        description: e instanceof Error ? e.message : t("common.retry"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const open = async (n: NotifItem) => {
    if (!n.read) act({ action: "read", ids: [n._id] });
    if (n.link) router.push(n.link);
  };

  return (
    <DashboardShell
      role={role}
      nav={nav}
      title={t("nav.notifications")}
      subtitle={t("common.notificationsSubtitle")}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v);
              setPage(1);
            }}
          >
            <TabsList className="h-auto flex-wrap justify-start gap-1">
              {TABS.map((tb) => (
                <TabsTrigger key={tb.value} value={tb.value} className="gap-1.5">
                  {t(tb.key)}
                  {tb.value === "unread" && (data?.unread || 0) > 0 && (
                    <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                      {data?.unread}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !data?.unread}
              onClick={() => act({ action: "read_all" }, t("common.markAllRead"))}
            >
              <CheckCheck className="mr-1.5 h-4 w-4" /> {t("common.markAllRead")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={load}
              aria-label={t("common.refresh")}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted/30" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-14 text-center">
            <BellOff className="h-9 w-9 text-muted-foreground" />
            <p className="mt-3 font-medium">{t("common.noNotifications")}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {t("common.notificationsEmptyDesc")}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.items.map((n) => {
              const Icon = CATEGORY_ICON[n.category] || Bell;
              const row = (
                <div
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition hover:border-primary/40 ${
                    n.read ? "bg-card" : "border-primary/30 bg-primary/5"
                  }`}
                  onClick={() => open(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open(n);
                    }
                  }}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      {!n.read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                    )}
                    {n.link && (
                      <Badge variant="outline" className="mt-1.5 text-[10px]">
                        {t("common.notificationsOpen")}
                      </Badge>
                    )}
                  </div>
                </div>
              );
              return (
                <li key={n._id} className="group relative">
                  {row}
                  <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    {!n.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={busy}
                        aria-label={t("common.markAsRead")}
                        onClick={(e) => {
                          e.stopPropagation();
                          act({ action: "read", ids: [n._id] });
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={busy}
                      aria-label={t("common.delete")}
                      onClick={(e) => {
                        e.stopPropagation();
                        act({ action: "delete", ids: [n._id] });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t("admin.pagination.prev")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t("admin.pagination.pageOf", { page: data.page, pages: data.pages, total: data.total })}
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
    </DashboardShell>
  );
}

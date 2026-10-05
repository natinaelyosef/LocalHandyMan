"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  LogOut,
  Menu,
  X,
  CheckCheck,
  HardHat,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRequireAuth, dashboardHome, type Role } from "@/context/auth";
import { api, fileUrl, timeAgo } from "@/lib/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleToggle } from "@/components/locale-toggle";
import { useLocale } from "@/context/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NavItem = { href: string; label: string; icon: LucideIcon };

type Notif = { _id: string; title: string; body: string; link: string; read: boolean; createdAt: string; category: string };

export function DashboardShell({
  role,
  nav,
  title,
  subtitle,
  children,
}: {
  role: Role;
  nav: NavItem[];
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { user, loading, logout } = useRequireAuth([role]);
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  const loadNotifs = async () => {
    try {
      const data = await api<{ items: Notif[]; unread: number }>("/api/notifications?unread=1");
      setNotifs(data.items);
      setUnread(data.unread);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifs();
      const t = setInterval(loadNotifs, 45000);
      return () => clearInterval(t);
    }
  }, [user]);

  const markAll = async () => {
    try {
      await api("/api/notifications", { body: { action: "read_all" } });
      loadNotifs();
    } catch {
      /* ignore */
    }
  };

  if (loading || !user || user.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <HardHat className="mr-2 h-5 w-5 animate-pulse" /> {t("common.loading")}
      </div>
    );
  }

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => {
        const active = pathname === item.href || (item.href !== `/${role === "admin" ? "dashboard/admin" : `dashboard/${role}`}` && pathname.startsWith(item.href + "/"));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {t(item.label)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-background lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HardHat className="h-4 w-4" />
          </span>
          Local Handyman
        </div>
        <div className="px-3 py-4">
          <NavList />
        </div>
        <div className="mt-auto border-t p-3">
          <button
            onClick={async () => {
              await logout();
              router.push("/");
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" /> {t("common.logOut")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label={t("common.openMenu")}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label={t("common.notifications")}>
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-semibold">{t("common.notifications")}</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAll}>
                  <CheckCheck className="mr-1 h-3.5 w-3.5" /> {t("common.markAllRead")}
                </Button>
              </div>
              <ScrollArea className="max-h-96">
                {notifs.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t("common.noNotifications")}</p>
                )}
                {notifs.map((n) => (
                  <DropdownMenuItem
                    key={n._id}
                    className="flex flex-col items-start gap-0.5 px-4 py-2.5"
                    onClick={async () => {
                      try {
                        await api("/api/notifications", { body: { action: "read", ids: [n._id] } });
                      } catch { /* ignore */ }
                      if (n.link) router.push(n.link);
                      loadNotifs();
                    }}
                  >
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => router.push(`/dashboard/${role}/notifications`)}
                >
                  {t("common.notificationsViewAll")}
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle />
          <LocaleToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.avatarFileId ? fileUrl(user.avatarFileId) : ""} alt={user.name} />
                  <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                  <Badge variant="secondary" className="mt-1 w-fit capitalize">{role}</Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(dashboardHome(role))}>{t("common.dashboardHome")}</DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  await logout();
                  router.push("/");
                }}
              >
                <LogOut className="mr-2 h-4 w-4" /> {t("common.logOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-background">
            <div className="flex h-16 items-center justify-between border-b px-5 font-bold">
              Local Handyman
              <button onClick={() => setMobileOpen(false)} aria-label={t("common.closeMenu")}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <NavList onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="border-t p-3">
              <button
                onClick={async () => {
                  await logout();
                  router.push("/");
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                <LogOut className="h-4 w-4" /> {t("common.logOut")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

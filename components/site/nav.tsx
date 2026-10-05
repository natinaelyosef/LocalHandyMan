"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X, HardHat, User, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, dashboardHome } from "@/context/auth";
import { fileUrl } from "@/lib/client";
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

const LINKS = [
  { href: "/services", label: "nav.services" },
  { href: "/find-workers", label: "nav.findWorkers" },
  { href: "/how-it-works", label: "nav.howItWorks" },
  { href: "/faq", label: "nav.faq" },
];

export function SiteNav() {
  const { user, logout } = useAuth();
  const { t } = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HardHat className="h-5 w-5" />
          </span>
          <span>
            Local <span className="text-primary">Handyman</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === l.href ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {t(l.label)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <LocaleToggle />
          {user ? (
            <>
              <Button variant="outline" size="sm" onClick={() => router.push(dashboardHome(user.role))}>
                <LayoutDashboard className="mr-2 h-4 w-4" /> {t("common.dashboard")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full outline-none ring-primary/40 focus-visible:ring-2">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatarFileId ? fileUrl(user.avatarFileId) : ""} alt={user.name} />
                      <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{user.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push(dashboardHome(user.role))}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> {t("common.dashboard")}
                  </DropdownMenuItem>
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
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">
                  <User className="mr-2 h-4 w-4" /> {t("common.logIn")}
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">{t("common.getStarted")}</Link>
              </Button>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label={t("common.openMenu")}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t bg-background px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-2">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded px-2 py-2 text-sm font-medium hover:bg-muted">
                {t(l.label)}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2">
              <ThemeToggle />
              <LocaleToggle />
              {user ? (
                <Button size="sm" className="flex-1" onClick={() => router.push(dashboardHome(user.role))}>
                  {t("common.dashboard")}
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href="/login">{t("common.logIn")}</Link>
                  </Button>
                  <Button size="sm" className="flex-1" asChild>
                    <Link href="/register">{t("common.getStarted")}</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { t } = useLocale();
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HardHat className="h-4 w-4" />
            </span>
            Local Handyman
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t("nav.footer.blurb")}</p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">{t("nav.footer.forCustomers")}</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link className="hover:text-primary" href="/find-workers">{t("nav.findWorkers")}</Link></li>
            <li><Link className="hover:text-primary" href="/services">{t("nav.footer.browseServices")}</Link></li>
            <li><Link className="hover:text-primary" href="/how-it-works">{t("nav.howItWorks")}</Link></li>
            <li><Link className="hover:text-primary" href="/faq">{t("nav.faq")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">{t("nav.footer.forWorkers")}</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link className="hover:text-primary" href="/register?role=worker">{t("nav.footer.becomeWorker")}</Link></li>
            <li><Link className="hover:text-primary" href="/how-it-works#quotations">{t("nav.footer.quotationSystem")}</Link></li>
            <li><Link className="hover:text-primary" href="/faq#payments">{t("nav.footer.paymentRecords")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">{t("nav.footer.payments")}</h4>
          <p className="text-sm text-muted-foreground">{t("nav.footer.paymentsNote")}</p>
        </div>
      </div>
      <div className="border-t px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
        {t("nav.footer.rights", { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}

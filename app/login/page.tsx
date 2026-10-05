"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HardHat, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { LocaleToggle } from "@/components/locale-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth, dashboardHome } from "@/context/auth";
import { useLocale } from "@/context/locale";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot" | "reset">("login");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetInfo, setResetInfo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const res = await api<{ message: string; resetCode?: string }>("/api/auth/password", {
          body: { email },
        });
        setResetInfo(res.resetCode ? t("public.login.demoResetCode", { code: res.resetCode }) : res.message);
        setMode("reset");
        toast({ title: t("public.login.resetCodeSent") });
      } else if (mode === "reset") {
        const res = await api<{ message: string }>("/api/auth/password", {
          method: "PATCH",
          body: { email, code, password: newPassword },
        });
        toast({ title: t("public.login.passwordUpdated"), description: res.message });
        setMode("login");
        setResetInfo(null);
        setCode("");
        setNewPassword("");
      } else {
        const user = await login(email, password);
        const next = params.get("next");
        router.replace(next && next.startsWith("/") ? next : dashboardHome(user.role));
      }
    } catch (err) {
      toast({
        title: t("common.error"),
        description: err instanceof Error ? err.message : t("common.retry"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HardHat className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">
          {mode === "login" ? t("public.login.welcomeBack") : mode === "forgot" ? t("public.login.resetTitle") : t("public.login.enterResetCode")}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? t("public.login.desc")
            : t("public.login.forgotDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("public.login.emailPlaceholder")} />
          </div>

          {mode === "login" && (
            <div className="space-y-2">
              <Label htmlFor="password">{t("common.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute right-3 top-2.5 text-muted-foreground"
                  onClick={() => setShow(!show)}
                  aria-label={t("public.login.togglePassword")}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === "reset" && (
            <>
              {resetInfo && <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">{resetInfo}</p>}
              <div className="space-y-2">
                <Label htmlFor="code">{t("public.login.resetCode")}</Label>
                <Input id="code" required value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("public.login.codePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t("public.login.newPassword")}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("public.password.strengthHint")}
                />
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "login" ? t("common.logIn") : mode === "forgot" ? t("public.login.sendResetCode") : t("public.login.updatePassword")}
          </Button>

          <div className="flex items-center justify-between text-sm">
            {mode === "login" ? (
              <>
                <button type="button" className="text-primary hover:underline" onClick={() => setMode("forgot")}>
                  {t("public.login.forgot")}
                </button>
                <Link href="/register" className="text-primary hover:underline">
                  {t("common.register")}
                </Link>
              </>
            ) : (
              <button type="button" className="text-primary hover:underline" onClick={() => setMode("login")}>
                {t("public.login.backToLogin")}
              </button>
            )}
          </div>
        </form>

        <div className="mt-6 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">{t("public.login.demoAccounts")}</p>
          <p>customer@homehelp.et / Customer123!</p>
          <p>abebe@worker.et / Worker123!</p>
          <p>admin@homehelp.et / Admin123!</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  const { t } = useLocale();
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="absolute left-4 top-4 gap-2 text-muted-foreground">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" />
          {t("public.login.backToHome")}
        </Link>
      </Button>
      <div className="absolute right-4 top-4">
        <LocaleToggle />
      </div>
      <Suspense fallback={<div className="text-sm text-muted-foreground">{t("common.loading")}</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

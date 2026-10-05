"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HardHat, Loader2, User, Briefcase, ArrowLeft } from "lucide-react";
import { LocaleToggle } from "@/components/locale-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, dashboardHome } from "@/context/auth";
import { useLocale } from "@/context/locale";
import { useToast } from "@/hooks/use-toast";
import { PROFESSIONS, ETHIOPIAN_REGIONS } from "@/lib/constants";

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const { t } = useLocale();
  const [role, setRole] = useState<"customer" | "worker">(params.get("role") === "worker" ? "worker" : "customer");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    gender: "",
    profession: "",
    headline: "",
    yearsOfExperience: "0",
    startingPrice: "500",
    region: "Addis Ababa",
    city: "Addis Ababa",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await register({
        role,
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        gender: form.gender,
        profession: role === "worker" ? form.profession : undefined,
        headline: form.headline,
        yearsOfExperience: Number(form.yearsOfExperience),
        startingPrice: Number(form.startingPrice),
        region: form.region,
        city: form.city,
      });
      toast({
        title: role === "worker" ? t("public.register.applied") : t("public.register.created"),
        description:
          role === "worker"
            ? t("public.register.appliedDesc")
            : t("public.register.welcomeDesc"),
      });
      router.replace(dashboardHome(user.role));
    } catch (err) {
      toast({
        title: t("public.register.failed"),
        description: err instanceof Error ? err.message : t("common.retry"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HardHat className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">{t("public.register.title")}</CardTitle>
        <CardDescription>{t("public.register.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole("customer")}
            className={`flex flex-col items-center gap-1 rounded-lg border p-4 text-center transition ${
              role === "customer" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted"
            }`}
          >
            <User className="h-5 w-5" />
            <span className="font-medium">{t("public.register.needService")}</span>
            <span className="text-xs text-muted-foreground">{t("public.register.bookWorkers")}</span>
          </button>
          <button
            type="button"
            onClick={() => setRole("worker")}
            className={`flex flex-col items-center gap-1 rounded-lg border p-4 text-center transition ${
              role === "worker" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted"
            }`}
          >
            <Briefcase className="h-5 w-5" />
            <span className="font-medium">{t("public.register.offerServices")}</span>
            <span className="text-xs text-muted-foreground">{t("public.register.findJobs")}</span>
          </button>
        </div>

        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">{t("public.register.fullName")}</Label>
            <Input id="name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("common.email")}</Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t("common.phone")}</Label>
            <Input id="phone" required placeholder="+2519…" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("common.password")}</Label>
            <Input
              id="password"
              type="password"
              required
              placeholder={t("public.password.strengthHint")}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("public.register.gender")}</Label>
            <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("public.register.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t("public.register.male")}</SelectItem>
                <SelectItem value="female">{t("public.register.female")}</SelectItem>
                <SelectItem value="other">{t("public.register.other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "worker" && (
            <>
              <div className="space-y-2">
                <Label>{t("public.register.profession")}</Label>
                <Select value={form.profession} onValueChange={(v) => set("profession", v)} required>
                  <SelectTrigger>
                    <SelectValue placeholder={t("public.register.selectProfession")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROFESSIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="headline">{t("public.register.headline")}</Label>
                <Input
                  id="headline"
                  placeholder={t("public.register.headlinePlaceholder")}
                  value={form.headline}
                  onChange={(e) => set("headline", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="years">{t("public.register.years")}</Label>
                <Input
                  id="years"
                  type="number"
                  min={0}
                  max={60}
                  value={form.yearsOfExperience}
                  onChange={(e) => set("yearsOfExperience", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">{t("public.register.startingPrice")}</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  value={form.startingPrice}
                  onChange={(e) => set("startingPrice", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("public.register.region")}</Label>
                <Select value={form.region} onValueChange={(v) => set("region", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ETHIOPIAN_REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{t("public.city")}</Label>
                <Input id="city" required value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {role === "worker" ? t("public.register.applyWorker") : t("public.register.createCustomer")}
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground sm:col-span-2">
            {t("public.register.haveAccount")}{" "}
            <Link href="/login" className="text-primary hover:underline">
              {t("common.logIn")}
            </Link>
          </p>
          {role === "worker" && (
            <p className="text-center text-xs text-muted-foreground sm:col-span-2">
              {t("public.register.workerPendingA")} <strong>{t("public.register.workerPendingB")}</strong>{t("public.register.workerPendingC")}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
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
        <RegisterForm />
      </Suspense>
    </div>
  );
}

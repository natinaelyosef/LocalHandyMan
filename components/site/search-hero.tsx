"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/context/locale";

export default function SearchHero() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const router = useRouter();
  const { t } = useLocale();

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (city.trim()) params.set("city", city.trim());
    router.push(`/find-workers?${params.toString()}`);
  };

  return (
    <form onSubmit={go} className="mt-8 flex max-w-2xl flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("public.hero.searchPlaceholder")}
          className="h-12 bg-background pl-9 text-foreground"
          aria-label={t("public.hero.serviceLabel")}
        />
      </div>
      <Input
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder={t("public.city")}
        className="h-12 bg-background text-foreground sm:w-40"
        aria-label={t("public.city")}
      />
      <Button type="submit" size="lg" className="h-12 bg-white text-primary hover:bg-white/90">
        {t("common.search")}
      </Button>
    </form>
  );
}

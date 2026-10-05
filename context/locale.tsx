"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import enCommon from "@/i18n/en/common.json";
import amCommon from "@/i18n/am/common.json";
import enWorker from "@/i18n/en/worker.json";
import amWorker from "@/i18n/am/worker.json";
import enCustomer from "@/i18n/en/customer.json";
import amCustomer from "@/i18n/am/customer.json";
import enAdmin from "@/i18n/en/admin.json";
import amAdmin from "@/i18n/am/admin.json";
import enPublic from "@/i18n/en/public.json";
import amPublic from "@/i18n/am/public.json";
import { configureFormatters } from "@/lib/client";

export type Locale = "en" | "am";

export const LOCALE_COOKIE = "hh_locale";

const DICTS: Record<Locale, Record<string, string>> = {
  en: { ...enCommon, ...enWorker, ...enCustomer, ...enAdmin, ...enPublic },
  am: { ...amCommon, ...amWorker, ...amCustomer, ...amAdmin, ...amPublic },
};

function interpolate(raw: string, vars?: Record<string, string | number>): string {
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const raw = DICTS[locale][key] ?? DICTS.en[key];
  if (raw === undefined) {
    if (process.env.NODE_ENV === "development") console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  return interpolate(raw, vars);
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const cookie = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=(en|am)(?:;|$)`));
    const stored = cookie ? (cookie[1] as Locale) : null;
    if (stored && stored !== locale) setLocaleState(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
  };

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    }),
    [locale]
  );

  // Keep the non-React formatters in lib/client.ts (fmtDate, timeAgo, etb) in
  // sync with the active language. Without this they would keep rendering
  // English dates and "5m ago" regardless of the chosen locale.
  useEffect(() => {
    configureFormatters(value.t, locale === "am" ? "am-ET" : "en-GB");
  }, [locale, value.t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside <LocaleProvider>");
  return ctx;
}

export function useT(): LocaleContextValue["t"] {
  return useLocale().t;
}

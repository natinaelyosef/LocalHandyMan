import { cookies } from "next/headers";
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
import type { Locale } from "@/context/locale";

const DICTS: Record<Locale, Record<string, string>> = {
  en: { ...enCommon, ...enWorker, ...enCustomer, ...enAdmin, ...enPublic },
  am: { ...amCommon, ...amWorker, ...amCustomer, ...amAdmin, ...amPublic },
};

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const raw = store.get("hh_locale")?.value;
  return raw === "am" ? "am" : "en";
}

export async function getT(): Promise<(key: string, vars?: Record<string, string | number>) => string> {
  const locale = await getLocale();
  const dict = DICTS[locale];
  return (key: string, vars?: Record<string, string | number>) => {
    const raw = dict[key] ?? DICTS.en[key];
    if (raw === undefined) return key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
  };
}

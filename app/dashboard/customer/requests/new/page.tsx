"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Loader2, MapPin, Send, Sparkles, UserCheck, X } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, fmtDate } from "@/lib/client";
import {
  AvailabilityMonth,
  type AvailabilityDay,
} from "@/components/dashboard/availability-calendar";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { ETHIOPIAN_REGIONS } from "@/lib/constants";
import type { Address, Category, ServiceRequest } from "@/app/dashboard/customer/_lib/types";
import { FieldError, errText } from "@/app/dashboard/customer/_lib/ui";

type Photo = { file: File; url: string };

const URGENCIES = [
  { key: "normal", descKey: "customer.newReq.urgencyNormalDesc", cls: "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60" },
  { key: "urgent", descKey: "customer.newReq.urgencyUrgentDesc", cls: "border-orange-300 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/60" },
  { key: "emergency", descKey: "customer.newReq.urgencyEmergencyDesc", cls: "border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/60" },
];

export default function NewRequestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLocale();

  const [categories, setCategories] = useState<Category[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [mode, setMode] = useState<"saved" | "manual">("saved");
  const [addressId, setAddressId] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [woreda, setWoreda] = useState("");
  const [area, setArea] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [budget, setBudget] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [access, setAccess] = useState("");
  const [special, setSpecial] = useState("");
  const [measurements, setMeasurements] = useState("");
  const [materials, setMaterials] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ categories: Category[] }>("/api/categories")
      .then((d) => alive && setCategories(d.categories || []))
      .catch(() => {});
    api<{ addresses: Address[] }>("/api/addresses")
      .then((d) => {
        if (!alive) return;
        const list = d.addresses || [];
        setAddresses(list);
        if (list.length) setAddressId(list[0]._id);
        else setMode("manual");
      })
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const w = params.get("worker");
    if (w) {
      setWorkerId(w);
      api<{ worker: { name: string } }>(`/api/workers/${w}`)
        .then((d) => alive && setWorkerName(d.worker.name))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, []);

  const photoRef = useRef<Photo[]>(photos);
  photoRef.current = photos;
  useEffect(() => {
    const current = photoRef;
    return () => {
      current.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  // When a specific worker is chosen, load their open days so the preferred
  // date can only be set to a day they are actually free.
  const [workerAvailability, setWorkerAvailability] = useState<AvailabilityDay[]>([]);
  useEffect(() => {
    if (!workerId) {
      setWorkerAvailability([]);
      return;
    }
    let cancelled = false;
    api<{ days: AvailabilityDay[] }>(`/api/workers/${workerId}/availability?days=30`)
      .then((d) => {
        if (!cancelled) setWorkerAvailability(d.days || []);
      })
      .catch(() => {
        if (!cancelled) setWorkerAvailability([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  const tops = categories.filter((c) => !c.parent);
  const subs = categories.filter((c) => c.parent && String(c.parent) === categoryId);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files)) {
      if (next.length >= 3) break;
      if (!f.type.startsWith("image/")) continue;
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    setPhotos(next);
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => {
      const copy = [...prev];
      const removed = copy.splice(idx, 1)[0];
      if (removed) URL.revokeObjectURL(removed.url);
      return copy;
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!categoryId) e.categoryId = t("customer.newReq.errCategory");
    if (title.trim().length < 4) e.title = t("customer.newReq.errTitle");
    if (description.trim().length < 10) e.description = t("customer.newReq.errDescription");
    if (mode === "saved") {
      if (!addressId) e.addressId = t("customer.newReq.errAddress");
    } else {
      if (!region.trim()) e.region = t("customer.newReq.errRegion");
      if (!city.trim()) e.city = t("customer.newReq.errCity");
    }
    if (budget && (Number.isNaN(Number(budget)) || Number(budget) < 0)) e.budget = t("customer.newReq.errBudget");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (saving) return;
    if (!validate()) {
      toast({ title: t("customer.newReq.checkForm"), description: t("customer.newReq.checkFormDesc"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("categoryId", categoryId);
      if (subCategoryId) fd.append("subCategoryId", subCategoryId);
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("urgency", urgency);
      if (mode === "saved") {
        fd.append("addressId", addressId);
      } else {
        fd.append("locationLabel", "Job site");
        fd.append("region", region.trim());
        fd.append("city", city.trim());
        fd.append("woreda", woreda.trim());
        fd.append("area", area.trim());
      }
      if (preferredDate) fd.append("preferredDate", preferredDate);
      if (preferredTime) fd.append("preferredTime", preferredTime);
      if (budget) fd.append("budget", budget);
      fd.append("accessInstructions", access);
      fd.append("specialInstructions", special);
      fd.append("measurements", measurements);
      fd.append("requiredMaterials", materials);
      if (workerId) fd.append("preferredWorkerId", workerId);
      photos.forEach((p, i) => fd.append(`photo${i + 1}`, p.file));

      const res = await api<{ request: ServiceRequest }>("/api/requests", { form: fd });
      toast({
        title: t("customer.newReq.postedToast"),
        description: t("customer.newReq.postedToastDesc"),
      });
      router.push(`/dashboard/customer/requests/${res.request._id}`);
    } catch (e) {
      toast({ title: t("customer.newReq.failedToast"), description: errText(e, t), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell
      role="customer"
      nav={CUSTOMER_NAV}
      title={t("nav.newRequest")}
      subtitle={t("customer.newReq.subtitle")}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {workerId && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <UserCheck className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">
                {t("customer.newReq.specificWorker", { name: workerName || t("customer.thisWorkerLower") })}
              </p>
              <p className="text-muted-foreground">
                {t("customer.newReq.specificWorkerHint")}{" "}
                <Link className="underline" href={`/workers/${workerId}`}>
                  {t("customer.viewProfile")}
                </Link>
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setWorkerId("");
                setWorkerName("");
              }}
            >
              <X className="mr-1 h-4 w-4" /> {t("common.remove")}
            </Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("customer.newReq.jobDetails")}</CardTitle>
            <CardDescription>{t("customer.newReq.jobDetailsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("customer.newReq.serviceCategory")} *</Label>
                <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubCategoryId(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("customer.newReq.selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {tops.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.icon ? `${c.icon} ` : ""}
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError msg={errors.categoryId} />
              </div>

              <div className="space-y-2">
                <Label>{t("customer.newReq.subcategory")}</Label>
                <Select value={subCategoryId} onValueChange={setSubCategoryId} disabled={!subs.length}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        subs.length ? t("customer.newReq.selectSubcategory") : t("customer.newReq.noSubcategories")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {subs.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">{t("customer.newReq.jobTitle")} *</Label>
              <Input
                id="title"
                placeholder={t("customer.newReq.jobTitlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <FieldError msg={errors.title} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">{t("customer.newReq.describeLabel")} *</Label>
              <Textarea
                id="desc"
                rows={5}
                placeholder={t("customer.newReq.describePlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <FieldError msg={errors.description} />
                <span className="text-xs text-muted-foreground">
                  {t("customer.newReq.characters", { n: description.trim().length })}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("customer.newReq.urgencyLabel")} *</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {URGENCIES.map((u) => {
                  const selected = urgency === u.key;
                  return (
                    <button
                      key={u.key}
                      type="button"
                      onClick={() => setUrgency(u.key)}
                      className={`rounded-xl border-2 p-3 text-left transition ${
                        selected ? "border-primary ring-2 ring-primary/30" : `${u.cls} hover:border-foreground/30`
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {u.key === "emergency" && <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />}
                        {u.key === "urgent" && <Sparkles className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
                        {t(`common.urgency.${u.key}`)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{t(u.descKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("customer.newReq.jobLocation")}</CardTitle>
            <CardDescription>{t("customer.newReq.jobLocationDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={mode === "saved" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("saved")}
                disabled={!addresses.length}
              >
                <MapPin className="mr-2 h-4 w-4" /> {t("customer.newReq.useSavedAddress")}
              </Button>
              <Button
                type="button"
                variant={mode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("manual")}
              >
                {t("customer.newReq.useOtherLocation")}
              </Button>
            </div>

            {mode === "saved" ? (
              addresses.length ? (
                <div className="space-y-2">
                  <Label>{t("customer.newReq.savedAddress")}</Label>
                  <Select value={addressId} onValueChange={setAddressId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("customer.newReq.selectAddress")} />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((a) => (
                        <SelectItem key={a._id} value={a._id}>
                          {a.label} — {[a.area, a.city, a.region].filter(Boolean).join(", ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError msg={errors.addressId} />
                  <p className="text-xs text-muted-foreground">
                    {t("customer.newReq.needNewAddress")}{" "}
                    <Link className="underline" href="/dashboard/customer/profile">
                      {t("customer.newReq.manageAddresses")}
                    </Link>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("customer.newReq.noSavedAddresses")}</p>
              )
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="region">{t("customer.newReq.region")} *</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger id="region">
                      <SelectValue placeholder={t("customer.newReq.selectRegion")} />
                    </SelectTrigger>
                    <SelectContent>
                      {ETHIOPIAN_REGIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError msg={errors.region} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{t("customer.newReq.city")} *</Label>
                  <Input id="city" placeholder={t("customer.newReq.cityPlaceholder")} value={city} onChange={(e) => setCity(e.target.value)} />
                  <FieldError msg={errors.city} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="woreda">{t("customer.newReq.woreda")}</Label>
                  <Input id="woreda" placeholder={t("customer.newReq.woredaPlaceholder")} value={woreda} onChange={(e) => setWoreda(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="area">{t("customer.newReq.area")}</Label>
                  <Input id="area" placeholder={t("customer.newReq.areaPlaceholder")} value={area} onChange={(e) => setArea(e.target.value)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("customer.newReq.whenBudget")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date">{t("customer.newReq.preferredDate")}</Label>
              <Input id="date" type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">{t("customer.newReq.preferredTime")}</Label>
              <Input id="time" type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">{t("customer.newReq.budgetLabel")}</Label>
              <Input
                id="budget"
                type="number"
                min={0}
                placeholder={t("customer.newReq.budgetPlaceholder")}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
              <FieldError msg={errors.budget} />
            </div>
          </CardContent>
        </Card>

        {workerId && workerAvailability.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("common.schedulePickDate")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("common.scheduleAvailableOn", {
                  n: workerAvailability.filter((d) => d.available).length,
                  total: workerAvailability.length,
                })}
              </p>
              <AvailabilityMonth
                days={workerAvailability}
                selected={preferredDate || null}
                onSelect={(date) => {
                  setPreferredDate(date);
                  setErrors((e) => ({ ...e, preferredDate: "" }));
                }}
              />
              {preferredDate && (
                <p className="text-xs text-muted-foreground">{fmtDate(preferredDate)}</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("customer.newReq.photos")}</CardTitle>
            <CardDescription>{t("customer.newReq.photosDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {photos.map((p, i) => (
                <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={t("customer.newReq.uploadAlt", { n: i + 1 })} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={t("customer.newReq.removePhoto")}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < 3 && (
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground transition hover:border-primary hover:text-primary">
                  <Camera className="h-5 w-5" />
                  <span className="text-[11px]">{t("customer.newReq.addPhoto")}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      onFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("customer.newReq.photosCount", { n: photos.length })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("customer.newReq.extraDetails")}</CardTitle>
            <CardDescription>{t("customer.newReq.extraDetailsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="access">{t("customer.newReq.accessInstructions")}</Label>
              <Textarea
                id="access"
                rows={2}
                placeholder={t("customer.newReq.accessPlaceholder")}
                value={access}
                onChange={(e) => setAccess(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="special">{t("customer.newReq.specialInstructions")}</Label>
              <Textarea
                id="special"
                rows={2}
                placeholder={t("customer.newReq.specialPlaceholder")}
                value={special}
                onChange={(e) => setSpecial(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="meas">{t("customer.newReq.measurements")}</Label>
                <Textarea
                  id="meas"
                  rows={3}
                  placeholder={t("customer.newReq.measurementsPlaceholder")}
                  value={measurements}
                  onChange={(e) => setMeasurements(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mat">{t("customer.newReq.materials")}</Label>
                <Textarea
                  id="mat"
                  rows={3}
                  placeholder={t("customer.newReq.materialsPlaceholder")}
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t("customer.newReq.replyHint")}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/dashboard/customer/requests")} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {t("customer.newReq.postRequest")}
            </Button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

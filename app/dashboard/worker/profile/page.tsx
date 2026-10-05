"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  ExternalLink,
  FileText,
  Globe,
  KeyRound,
  LoaderCircle,
  Lock,
  Mail,
  MapPin,
  Plus,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { WORKER_NAV } from "@/components/dashboard/nav-config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, fileUrl, fmtDate } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { ETHIOPIAN_REGIONS, PROFESSIONS } from "@/lib/constants";
import {
  DAYS,
  DOC_TYPE_LABEL,
  VerificationBanner,
  defaultSchedule,
  useErrMsg,
  type CategoryT,
  type ScheduleSlot,
  type WorkerDocumentT,
  type WorkerProfileT,
} from "../_shared";

const NONE = "__none__";

function docStatusClass(status: string): string {
  if (status === "approved") return "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300";
  if (status === "rejected") return "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300";
  return "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300";
}

function n(v: string): number {
  const x = Number(v);
  return isNaN(x) ? 0 : x;
}

export default function WorkerProfilePage() {
  const { t } = useLocale();
  const errMsg = useErrMsg();
  const { toast } = useToast();
  const [profile, setProfile] = useState<WorkerProfileT | null>(null);
  const [user, setUser] = useState<{ _id?: string; name?: string; email?: string; phone?: string } | null>(null);
  const [categories, setCategories] = useState<CategoryT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inited, setInited] = useState(false);

  const [docType, setDocType] = useState("id");
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docBusy, setDocBusy] = useState(false);

  const [profession, setProfession] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [years, setYears] = useState("0");
  const [languages, setLanguages] = useState("");
  const [price, setPrice] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [catIds, setCatIds] = useState<string[]>([]);
  const [infoBusy, setInfoBusy] = useState(false);

  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [woreda, setWoreda] = useState("");
  const [radius, setRadius] = useState("15");
  const [emergency, setEmergency] = useState(false);
  const [areaBusy, setAreaBusy] = useState(false);

  const [availability, setAvailability] = useState("available");
  const [schedule, setSchedule] = useState<ScheduleSlot[]>(defaultSchedule());
  const [availBusy, setAvailBusy] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  const [accountName, setAccountName] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountErr, setAccountErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, c] = await Promise.all([
        api<{ profile: WorkerProfileT | null; user: { _id?: string; name?: string; email?: string; phone?: string } | null }>(
          "/api/worker/profile"
        ),
        api<{ tree: CategoryT[] }>("/api/categories"),
      ]);
      setProfile(p.profile);
      setUser(p.user);
      setCategories(c.tree || []);
      if (p.user) {
        setAccountName(p.user.name || "");
        setAccountPhone(p.user.phone || "");
      }
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [errMsg]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile || inited) return;
    setProfession(profile.profession || "");
    setHeadline(profile.headline || "");
    setBio(profile.bio || "");
    setSkills(profile.skills || []);
    setYears(String(profile.yearsOfExperience ?? 0));
    setLanguages((profile.languages || []).join(", "));
    setPrice(String(profile.startingPrice ?? 0));
    setPriceNote(profile.priceNote || "");
    setCatIds(profile.categoryIds || []);
    setRegion(profile.serviceArea?.region || "");
    setCity(profile.serviceArea?.city || "");
    setWoreda(profile.serviceArea?.woreda || "");
    setRadius(String(profile.serviceArea?.radiusKm ?? 15));
    setEmergency(!!profile.emergencyAvailable);
    setAvailability(profile.availability || "available");
    if (profile.schedule && profile.schedule.length === 7) setSchedule(profile.schedule);
    setInited(true);
  }, [profile, inited]);

  /* --------------------------------- helpers -------------------------------- */

  const addSkill = () => {
    const v = skillInput.trim();
    if (!v) return;
    if (!skills.includes(v)) setSkills((prev) => [...prev, v]);
    setSkillInput("");
  };

  const updateSchedule = (day: string, patch: Partial<ScheduleSlot>) =>
    setSchedule((prev) => prev.map((s) => (s.day === day ? { ...s, ...patch } : s)));

  /* -------------------------------- documents ------------------------------- */

  const uploadDocument = async () => {
    if (!docTitle.trim() || !docFile) {
      toast({ title: t("worker.profile.docTitleFileRequired"), variant: "destructive" });
      return;
    }
    setDocBusy(true);
    try {
      const form = new FormData();
      form.append("file", docFile);
      form.append("type", docType);
      form.append("title", docTitle.trim());
      await api<{ documents: WorkerDocumentT[] }>("/api/worker/documents", { form });
      toast({ title: t("worker.profile.docUploaded"), description: t("worker.profile.docUploadedDesc") });
      setDocTitle("");
      setDocFile(null);
      await load();
    } catch (err) {
      toast({ title: t("worker.profile.uploadFailed"), description: errMsg(err), variant: "destructive" });
    } finally {
      setDocBusy(false);
    }
  };

  const deleteDocument = async (doc: WorkerDocumentT) => {
    if (!window.confirm(t("worker.profile.deleteDocConfirm", { title: doc.title }))) return;
    try {
      const d = await api<{ documents: WorkerDocumentT[] }>(`/api/worker/documents?id=${encodeURIComponent(doc._id)}`, {
        method: "DELETE",
      });
      if (profile) setProfile({ ...profile, documents: d.documents });
      toast({ title: t("worker.profile.docDeleted") });
    } catch (err) {
      toast({ title: t("worker.profile.couldNotDelete"), description: errMsg(err), variant: "destructive" });
    }
  };

  /* ---------------------------------- saves --------------------------------- */

  const patchProfile = async (
    body: Record<string, unknown>,
    busySetter: (v: boolean) => void,
    okMessage: string
  ): Promise<void> => {
    busySetter(true);
    try {
      const d = await api<{ profile: WorkerProfileT }>("/api/worker/profile", { method: "PATCH", body });
      setProfile(d.profile);
      toast({ title: okMessage });
    } catch (err) {
      toast({ title: t("worker.profile.couldNotSave"), description: errMsg(err), variant: "destructive" });
    } finally {
      busySetter(false);
    }
  };

  const saveInfo = () =>
    patchProfile(
      {
        profession,
        headline,
        bio,
        skills,
        yearsOfExperience: n(years),
        languages: languages.split(",").map((s) => s.trim()).filter(Boolean),
        startingPrice: n(price),
        priceNote,
        categoryIds: catIds,
      },
      setInfoBusy,
      t("worker.profile.infoSaved")
    );

  const saveArea = () =>
    patchProfile(
      {
        serviceArea: { region, city, woreda, radiusKm: Math.min(200, Math.max(1, n(radius) || 1)) },
        emergencyAvailable: emergency,
      },
      setAreaBusy,
      t("worker.profile.areaSaved")
    );

  const saveAvailability = () => patchProfile({ availability, schedule }, setAvailBusy, t("worker.profile.availSaved"));

  const changePassword = async () => {
    if (!currentPw || !newPw) {
      toast({ title: t("worker.profile.pwBothRequired"), variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: t("worker.profile.pwNoMatch"), variant: "destructive" });
      return;
    }
    setPwBusy(true);
    try {
      await api("/api/profile", { method: "POST", body: { currentPassword: currentPw, newPassword: newPw } });
      toast({ title: t("worker.profile.pwChanged") });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      toast({ title: t("worker.profile.pwFailed"), description: errMsg(err), variant: "destructive" });
    } finally {
      setPwBusy(false);
    }
  };

  const saveAccount = async () => {
    const trimmedName = accountName.trim();
    const trimmedPhone = accountPhone.trim();
    if (trimmedName.length < 2) {
      setAccountErr(t("worker.profile.accountNameRequired"));
      return;
    }
    if (!/^\+?\d{7,15}$/.test(trimmedPhone.replace(/[\s-]/g, ""))) {
      setAccountErr(t("worker.profile.accountPhoneInvalid"));
      return;
    }
    setAccountErr("");
    setAccountBusy(true);
    try {
      const d = await api<{ user: { name: string; phone: string } }>("/api/profile", {
        method: "PATCH",
        body: { name: trimmedName, phone: trimmedPhone },
      });
      setUser((prev) => (prev ? { ...prev, name: d.user.name, phone: d.user.phone } : prev));
      toast({ title: t("worker.profile.accountSaved") });
    } catch (err) {
      setAccountErr(errMsg(err));
    } finally {
      setAccountBusy(false);
    }
  };

  /* -------------------------------- rendering -------------------------------- */

  if (loading) {
    return (
      <DashboardShell role="worker" nav={WORKER_NAV} title={t("nav.profileAvailability")} subtitle={t("common.loading")}>
        <div className="mx-auto max-w-5xl space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border bg-card" />
          ))}
        </div>
      </DashboardShell>
    );
  }

  if (error || !profile) {
    return (
      <DashboardShell role="worker" nav={WORKER_NAV} title={t("nav.profileAvailability")} subtitle={t("worker.error.somethingWrong")}>
        <div className="mx-auto max-w-5xl">
          <Alert variant="destructive">
            <AlertTitle>{t("worker.profile.loadFailedTitle")}</AlertTitle>
            <AlertDescription className="flex items-center gap-3">
              {error || t("worker.profile.notFound")}
              <Button size="sm" variant="outline" onClick={() => void load()}>
                {t("common.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </DashboardShell>
    );
  }

  const documents = profile.documents || [];
  const canResubmit = profile.status === "rejected" || profile.status === "resubmit_required";

  return (
    <DashboardShell role="worker" nav={WORKER_NAV} title={t("nav.profileAvailability")} subtitle={t("worker.profile.subtitle")}>
      <div className="mx-auto max-w-5xl space-y-6">
        <VerificationBanner profile={profile} onResubmitted={setProfile} />

        {/* ------------------------------ (a) documents ----------------------------- */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-1.5 text-base">
                <FileText className="h-4 w-4 text-primary" /> {t("worker.profile.verifyDocs")}
              </CardTitle>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/workers/${profile.userId}`}>
                    <ExternalLink className="mr-1.5 h-4 w-4" /> {t("worker.profile.viewPublic")}
                  </Link>
                </Button>
                {canResubmit && (
                  <Button
                    size="sm"
                    onClick={() =>
                      void patchProfile({ resubmit: true }, setDocBusy, t("worker.profile.resubmitted"))
                    }
                    disabled={docBusy}
                  >
                    <BadgeCheck className="mr-1.5 h-4 w-4" /> {t("worker.profile.resubmit")}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {documents.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {t("worker.profile.noDocs")}
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {documents.map((d) => (
                  <div key={d._id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{d.title}</span>
                        <Badge variant="outline">{t(DOC_TYPE_LABEL[d.type] || d.type)}</Badge>
                        <Badge className={docStatusClass(d.status)} variant="secondary">
                          {t(`worker.docStatus.${d.status}`)}
                        </Badge>
                      </div>
                      {d.reviewNote && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {t("worker.profile.reviewer", { note: d.reviewNote })}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {d.fileId && (
                          <a href={fileUrl(d.fileId)} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            {t("worker.profile.viewFile")}
                          </a>
                        )}
                        {d.reviewedAt && <span>{t("worker.profile.reviewedOn", { date: fmtDate(d.reviewedAt) })}</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-red-600"
                      onClick={() => void deleteDocument(d)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {t("common.delete")}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="grid gap-3 sm:grid-cols-[160px_1fr_160px_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="doc-type">{t("worker.profile.docType")}</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger id="doc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {t(label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-title">{t("worker.profile.docTitle")}</Label>
                <Input id="doc-title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder={t("worker.profile.docTitlePlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc-file">{t("worker.profile.docFile")}</Label>
                <Input id="doc-file" type="file" accept="image/*,.pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
              </div>
              <Button onClick={() => void uploadDocument()} disabled={docBusy}>
                {docBusy ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
                {t("worker.profile.upload")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ----------------------------- (b) public info ---------------------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <UserRound className="h-4 w-4 text-primary" /> {t("worker.profile.publicInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profession">{t("worker.profile.profession")}</Label>
                <Select value={profession || undefined} onValueChange={setProfession}>
                  <SelectTrigger id="profession">
                    <SelectValue placeholder={t("worker.profile.selectProfession")} />
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
              <div className="space-y-1.5">
                <Label htmlFor="headline">{t("worker.profile.headline")}</Label>
                <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={t("worker.profile.headlinePlaceholder")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio">{t("worker.profile.bio")}</Label>
              <Textarea id="bio" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t("worker.profile.bioPlaceholder")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="skill-input">{t("worker.profile.skills")}</Label>
              <div className="flex gap-2">
                <Input
                  id="skill-input"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder={t("worker.profile.skillPlaceholder")}
                />
                <Button type="button" variant="outline" onClick={addSkill}>
                  {t("worker.profile.addSkill")}
                </Button>
              </div>
              {skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {s}
                      <button
                        onClick={() => setSkills((prev) => prev.filter((x) => x !== s))}
                        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                        aria-label={t("worker.profile.removeSkill", { skill: s })}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="years">{t("worker.profile.yearsExp")}</Label>
                <Input id="years" type="number" min={0} value={years} onChange={(e) => setYears(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="languages">{t("worker.profile.languages")}</Label>
                <Input id="languages" value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder={t("worker.profile.languagesPlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price">{t("worker.profile.startingPrice")}</Label>
                <Input id="price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price-note">{t("worker.profile.priceNote")}</Label>
              <Input id="price-note" value={priceNote} onChange={(e) => setPriceNote(e.target.value)} placeholder={t("worker.profile.priceNotePlaceholder")} />
            </div>

            <div className="space-y-2">
              <Label>{t("worker.profile.serviceCats")}</Label>
              <p className="text-xs text-muted-foreground">{t("worker.profile.catsHint")}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((c) => {
                  const checked = catIds.includes(c._id);
                  return (
                    <label
                      key={c._id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm transition ${
                        checked ? "border-primary bg-primary/5" : "hover:border-primary/40"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          setCatIds((prev) => (v ? [...prev, c._id] : prev.filter((x) => x !== c._id)))
                        }
                      />
                      <span className="truncate">{c.icon ? `${c.icon} ` : ""}{c.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void saveInfo()} disabled={infoBusy}>
                {infoBusy ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {t("worker.profile.saveInfo")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ---------------------------- (c) service area ---------------------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <MapPin className="h-4 w-4 text-primary" /> {t("worker.profile.serviceArea")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="region">{t("worker.profile.region")}</Label>
                <Select value={region || NONE} onValueChange={(v) => setRegion(v === NONE ? "" : v)}>
                  <SelectTrigger id="region">
                    <SelectValue placeholder={t("worker.profile.selectRegion")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("common.notSet")}</SelectItem>
                    {ETHIOPIAN_REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">{t("worker.profile.city")}</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("worker.profile.cityPlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="woreda">{t("worker.profile.woreda")}</Label>
                <Input id="woreda" value={woreda} onChange={(e) => setWoreda(e.target.value)} placeholder={t("worker.profile.woredaPlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="radius">{t("worker.profile.serviceRadius")}</Label>
                  <span className="text-sm font-semibold">{t("worker.profile.km", { km: radius })}</span>
                </div>
                <input
                  id="radius"
                  type="range"
                  min={1}
                  max={200}
                  value={n(radius) || 1}
                  onChange={(e) => setRadius(e.target.value)}
                  className="w-full accent-primary"
                />
                <Input type="number" min={1} max={200} value={radius} onChange={(e) => setRadius(e.target.value)} />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-3">
              <Checkbox checked={emergency} onCheckedChange={(v) => setEmergency(v === true)} />
              <span className="text-sm">
                <span className="font-medium">{t("worker.profile.emergencyTitle")}</span>
                <span className="block text-xs text-muted-foreground">{t("worker.profile.emergencyDesc")}</span>
              </span>
            </label>

            <div className="flex justify-end">
              <Button onClick={() => void saveArea()} disabled={areaBusy}>
                {areaBusy ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {t("worker.profile.saveArea")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ----------------------------- (d) availability --------------------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Globe className="h-4 w-4 text-primary" /> {t("worker.profile.availSchedule")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="availability">{t("worker.profile.currentStatus")}</Label>
                <Select value={availability} onValueChange={setAvailability}>
                  <SelectTrigger id="availability">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["available", "busy", "away", "offline"].map((v) => (
                      <SelectItem key={v} value={v}>
                        {t(`worker.availability.${v}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Alert className="w-full">
                  <AlertTitle className="text-sm">{t("worker.profile.offlineTitle")}</AlertTitle>
                  <AlertDescription className="text-xs">{t("worker.profile.offlineDesc")}</AlertDescription>
                </Alert>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("worker.profile.weeklySchedule")}</Label>
              <div className="divide-y rounded-lg border">
                {DAYS.map((d) => {
                  const slot = schedule.find((s) => s.day === d.key) || { day: d.key, open: "08:00", close: "17:00", closed: false };
                  const dayLabel = t(d.label);
                  return (
                    <div key={d.key} className="flex flex-wrap items-center gap-3 p-3">
                      <label className="flex w-32 cursor-pointer items-center gap-2 text-sm font-medium">
                        <Checkbox
                          checked={!slot.closed}
                          onCheckedChange={(v) => updateSchedule(d.key, { closed: v !== true })}
                        />
                        {dayLabel}
                      </label>
                      {slot.closed ? (
                        <span className="text-sm text-muted-foreground">{t("worker.profile.closed")}</span>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <Input
                            type="time"
                            value={slot.open}
                            onChange={(e) => updateSchedule(d.key, { open: e.target.value })}
                            className="h-9 w-32"
                            aria-label={t("worker.profile.openingTime", { day: dayLabel })}
                          />
                          <span className="text-muted-foreground">{t("worker.profile.to")}</span>
                          <Input
                            type="time"
                            value={slot.close}
                            onChange={(e) => updateSchedule(d.key, { close: e.target.value })}
                            className="h-9 w-32"
                            aria-label={t("worker.profile.closingTime", { day: dayLabel })}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => void saveAvailability()} disabled={availBusy}>
                {availBusy ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {t("worker.profile.saveAvail")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* --------------------------- (e) account details -------------------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <UserRound className="h-4 w-4 text-primary" /> {t("worker.profile.accountDetails")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">{t("worker.profile.accountSubtitle")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="account-name">{t("worker.profile.accountName")}</Label>
                <Input
                  id="account-name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder={t("worker.profile.accountNamePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="account-phone">{t("worker.profile.accountPhone")}</Label>
                <Input
                  id="account-phone"
                  value={accountPhone}
                  onChange={(e) => setAccountPhone(e.target.value)}
                  placeholder={t("worker.profile.accountPhonePlaceholder")}
                />
              </div>
            </div>
            {accountErr && <p className="text-sm text-red-600 dark:text-red-400">{accountErr}</p>}
            <div className="flex justify-end">
              <Button onClick={() => void saveAccount()} disabled={accountBusy}>
                {accountBusy ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {t("worker.profile.saveAccount")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ------------------------------ (f) login info ---------------------------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Lock className="h-4 w-4 text-primary" /> {t("worker.profile.loginInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("worker.profile.email")}</Label>
              <div className="flex">
                <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </span>
                <Input id="email" value={user?.email || ""} readOnly className="rounded-l-none bg-muted/50" />
              </div>
              <p className="text-xs text-muted-foreground">{t("worker.profile.emailHint")}</p>
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="current-pw">{t("worker.profile.currentPw")}</Label>
                <Input id="current-pw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">{t("worker.profile.newPw")}</Label>
                <Input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw">{t("worker.profile.confirmPw")}</Label>
                <Input id="confirm-pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("worker.profile.pwRule")}</p>

            <div className="flex justify-end">
              <Button onClick={() => void changePassword()} disabled={pwBusy}>
                {pwBusy ? <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1.5 h-4 w-4" />}
                {t("worker.profile.changePw")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, KeyRound, Loader2, MapPin, Pencil, Plus, Trash2, UserCircle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, fileUrl } from "@/lib/client";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { ETHIOPIAN_REGIONS } from "@/lib/constants";
import type { Address } from "@/app/dashboard/customer/_lib/types";
import { FieldError, errText } from "@/app/dashboard/customer/_lib/ui";

const LABELS: { value: string; labelKey: string }[] = [
  { value: "Home", labelKey: "customer.profile.labelHome" },
  { value: "Office", labelKey: "customer.profile.labelOffice" },
  { value: "Shop", labelKey: "customer.profile.labelShop" },
  { value: "Rental", labelKey: "customer.profile.labelRental" },
  { value: "Other", labelKey: "customer.profile.labelOther" },
];

const emptyAddress = {
  label: "Home",
  region: "",
  city: "",
  woreda: "",
  subCity: "",
  area: "",
  street: "",
  notes: "",
  isDefault: false,
};

export default function CustomerProfilePage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const { t } = useLocale();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [addrListErr, setAddrListErr] = useState("");
  const [addrForm, setAddrForm] = useState(emptyAddress);
  const [addrDialog, setAddrDialog] = useState<{ mode: "add" | "edit"; id?: string } | null>(null);
  const [addrErrs, setAddrErrs] = useState<Record<string, string>>({});
  const [addrBusy, setAddrBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwErrs, setPwErrs] = useState<Record<string, string>>({});
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
      setGender(user.gender || "");
    }
  }, [user]);

  const loadAddresses = useCallback(async () => {
    setAddrLoading(true);
    setAddrListErr("");
    try {
      const d = await api<{ addresses: Address[] }>("/api/addresses");
      setAddresses(d.addresses || []);
    } catch (e) {
      setAddrListErr(errText(e, t));
    } finally {
      setAddrLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const saveProfile = async () => {
    if (name.trim().length < 2) {
      setProfileErr(t("customer.profile.nameError"));
      return;
    }
    setProfileBusy(true);
    setProfileErr("");
    try {
      await api("/api/profile", { method: "PATCH", body: { name: name.trim(), phone: phone.trim(), gender } });
      await refresh();
      toast({ title: t("customer.profile.savedTitle"), description: t("customer.profile.savedDesc") });
    } catch (e) {
      setProfileErr(errText(e, t));
    } finally {
      setProfileBusy(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setAvatarBusy(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      await api("/api/profile", { method: "PATCH", form: fd });
      await refresh();
      toast({ title: t("customer.profile.photoTitle"), description: t("customer.profile.photoDesc") });
    } catch (e) {
      toast({ title: t("customer.profile.photoFailed"), description: errText(e, t), variant: "destructive" });
    } finally {
      setAvatarBusy(false);
      if (avatarInput.current) avatarInput.current.value = "";
    }
  };

  const openAdd = () => {
    setAddrForm(emptyAddress);
    setAddrErrs({});
    setAddrDialog({ mode: "add" });
  };

  const openEdit = (a: Address) => {
    setAddrForm({
      label: a.label || "Home",
      region: a.region || "",
      city: a.city || "",
      woreda: a.woreda || "",
      subCity: a.subCity || "",
      area: a.area || "",
      street: a.street || "",
      notes: a.notes || "",
      isDefault: !!a.isDefault,
    });
    setAddrErrs({});
    setAddrDialog({ mode: "edit", id: a._id });
  };

  const saveAddress = async () => {
    const e: Record<string, string> = {};
    if (!addrForm.label) e.label = t("customer.profile.errLabel");
    if (!addrForm.region) e.region = t("customer.profile.errRegion");
    if (!addrForm.city.trim()) e.city = t("customer.profile.errCity");
    setAddrErrs(e);
    if (Object.keys(e).length) return;

    setAddrBusy(true);
    try {
      const payload = {
        label: addrForm.label,
        region: addrForm.region,
        city: addrForm.city.trim(),
        woreda: addrForm.woreda.trim(),
        subCity: addrForm.subCity.trim(),
        area: addrForm.area.trim(),
        street: addrForm.street.trim(),
        notes: addrForm.notes.trim(),
        isDefault: addrForm.isDefault,
      };
      if (addrDialog?.mode === "edit" && addrDialog.id) {
        await api("/api/addresses", { method: "PATCH", body: { id: addrDialog.id, ...payload } });
        toast({ title: t("customer.profile.addressUpdated") });
      } else {
        await api("/api/addresses", { method: "POST", body: payload });
        toast({ title: t("customer.profile.addressAdded") });
      }
      setAddrDialog(null);
      await loadAddresses();
    } catch (err) {
      setAddrErrs({ form: errText(err, t) });
    } finally {
      setAddrBusy(false);
    }
  };

  const deleteAddress = async () => {
    if (!deleteTarget) return;
    setAddrBusy(true);
    try {
      await api("/api/addresses", { method: "DELETE", body: { id: deleteTarget._id } });
      toast({ title: t("customer.profile.addressRemoved") });
      setDeleteTarget(null);
      await loadAddresses();
    } catch (e) {
      toast({ title: t("customer.profile.deleteFailed"), description: errText(e, t), variant: "destructive" });
    } finally {
      setAddrBusy(false);
    }
  };

  const changePassword = async () => {
    const e: Record<string, string> = {};
    if (!currentPw) e.currentPw = t("customer.profile.errCurrentPw");
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPw)) {
      e.newPw = t("customer.profile.errNewPw");
    }
    if (newPw !== confirmPw) e.confirmPw = t("customer.profile.errConfirmPw");
    setPwErrs(e);
    if (Object.keys(e).length) return;

    setPwBusy(true);
    try {
      await api("/api/profile", { method: "POST", body: { currentPassword: currentPw, newPassword: newPw } });
      toast({ title: t("customer.profile.pwTitle"), description: t("customer.profile.pwDesc") });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setPwErrs({ form: errText(err, t) });
    } finally {
      setPwBusy(false);
    }
  };

  const setAddr = (k: keyof typeof emptyAddress, v: string | boolean) =>
    setAddrForm((prev) => ({ ...prev, [k]: v }));

  return (
    <DashboardShell
      role="customer"
      nav={CUSTOMER_NAV}
      title={t("nav.profile")}
      subtitle={t("customer.profile.subtitle")}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" /> {t("customer.profile.personalInfo")}
            </CardTitle>
            <CardDescription>{t("customer.profile.personalInfoDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={user?.avatarFileId ? fileUrl(user.avatarFileId) : ""}
                  alt={user?.name || t("customer.profile.avatarAlt")}
                  className="h-20 w-20 rounded-full border bg-muted object-cover"
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden";
                  }}
                />
                {!user?.avatarFileId && (
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-muted-foreground">
                    {(user?.name || "?").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                  }}
                />
                <Button variant="outline" size="sm" disabled={avatarBusy} onClick={() => avatarInput.current?.click()}>
                  {avatarBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                  {t("customer.profile.changePhoto")}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">{t("customer.profile.photoHint")}</p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-name">{t("customer.profile.fullName")}</Label>
                <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-phone">{t("customer.profile.phone")}</Label>
                <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2519…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-gender">{t("customer.profile.gender")}</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger id="p-gender">
                    <SelectValue placeholder={t("customer.profile.selectGender")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("customer.profile.male")}</SelectItem>
                    <SelectItem value="female">{t("customer.profile.female")}</SelectItem>
                    <SelectItem value="other">{t("customer.profile.otherGender")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-email">{t("customer.profile.email")}</Label>
                <Input id="p-email" value={user?.email || ""} disabled />
              </div>
            </div>

            <FieldError msg={profileErr} />

            <div className="flex justify-end">
              <Button onClick={saveProfile} disabled={profileBusy}>
                {profileBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("customer.profile.saveChanges")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" /> {t("customer.profile.savedAddresses")}
                </CardTitle>
                <CardDescription>{t("customer.profile.savedAddressesDesc")}</CardDescription>
              </div>
              <Button size="sm" onClick={openAdd}>
                <Plus className="mr-2 h-4 w-4" /> {t("customer.profile.addAddress")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {addrLoading && <div className="h-16 animate-pulse rounded-lg bg-muted" />}
            {!addrLoading && addrListErr && <FieldError msg={addrListErr} />}
            {!addrLoading && !addrListErr && addresses.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {t("customer.profile.noAddresses")}
              </div>
            )}

            {!addrLoading &&
              addresses.map((a) => (
                <div key={a._id} className="flex flex-wrap items-start gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{a.label}</Badge>
                      {a.isDefault && (
                        <Badge className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                          {t("customer.profile.default")}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm">
                      {[a.subCity, a.area, a.street, a.city, a.region].filter(Boolean).join(", ") || a.city}
                    </p>
                    {(a.woreda || a.notes) && (
                      <p className="text-xs text-muted-foreground">
                        {[
                          a.woreda ? t("customer.profile.woredaN", { n: a.woreda }) : "",
                          a.notes,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(a)}
                      aria-label={t("customer.profile.editAddress")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 dark:text-red-400 hover:text-red-700"
                      onClick={() => setDeleteTarget(a)}
                      aria-label={t("customer.profile.deleteAddress")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> {t("customer.profile.changePassword")}
            </CardTitle>
            <CardDescription>{t("customer.profile.changePasswordDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pw-current">{t("customer.profile.currentPassword")}</Label>
                <Input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                />
                <FieldError msg={pwErrs.currentPw} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-new">{t("customer.profile.newPassword")}</Label>
                <Input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                />
                <FieldError msg={pwErrs.newPw} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-confirm">{t("customer.profile.confirmPassword")}</Label>
                <Input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                />
                <FieldError msg={pwErrs.confirmPw} />
              </div>
            </div>

            <ul className="space-y-1 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <li className={newPw.length >= 8 ? "text-emerald-600 dark:text-emerald-400" : ""}>
                ✓ {t("customer.profile.ruleLength")}
              </li>
              <li className={/[A-Z]/.test(newPw) && /[a-z]/.test(newPw) ? "text-emerald-600 dark:text-emerald-400" : ""}>
                ✓ {t("customer.profile.ruleCase")}
              </li>
              <li className={/\d/.test(newPw) ? "text-emerald-600 dark:text-emerald-400" : ""}>
                ✓ {t("customer.profile.ruleNumber")}
              </li>
            </ul>

            <FieldError msg={pwErrs.form} />

            <div className="flex justify-end">
              <Button onClick={changePassword} disabled={pwBusy}>
                {pwBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("customer.profile.updatePassword")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {t("customer.profile.needHelp")}{" "}
          <Link className="underline" href="/dashboard/customer/bookings">
            {t("nav.myBookings")}
          </Link>{" "}
          ·{" "}
          <Link className="underline" href="/dashboard/customer/requests">
            {t("nav.myRequests")}
          </Link>
        </p>
      </div>

      <Dialog open={!!addrDialog} onOpenChange={(o) => !o && setAddrDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {addrDialog?.mode === "edit" ? t("customer.profile.editAddressTitle") : t("customer.profile.addAddressTitle")}
            </DialogTitle>
            <DialogDescription>{t("customer.profile.addressDialogDesc")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("customer.profile.label")}</Label>
              <Select value={addrForm.label} onValueChange={(v) => setAddr("label", v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("customer.profile.selectLabel")} />
                </SelectTrigger>
                <SelectContent>
                  {LABELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {t(l.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError msg={addrErrs.label} />
            </div>

            <div className="space-y-2">
              <Label>{t("customer.profile.region")}</Label>
              <Select value={addrForm.region} onValueChange={(v) => setAddr("region", v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("customer.profile.selectRegion")} />
                </SelectTrigger>
                <SelectContent>
                  {ETHIOPIAN_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError msg={addrErrs.region} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="a-city">{t("customer.newReq.city")} *</Label>
              <Input id="a-city" value={addrForm.city} onChange={(e) => setAddr("city", e.target.value)} />
              <FieldError msg={addrErrs.city} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="a-woreda">{t("customer.profile.woreda")}</Label>
              <Input id="a-woreda" value={addrForm.woreda} onChange={(e) => setAddr("woreda", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="a-subcity">{t("customer.profile.subCity")}</Label>
              <Input id="a-subcity" value={addrForm.subCity} onChange={(e) => setAddr("subCity", e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="a-area">{t("customer.profile.area")}</Label>
              <Input id="a-area" value={addrForm.area} onChange={(e) => setAddr("area", e.target.value)} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="a-street">{t("customer.profile.street")}</Label>
              <Input id="a-street" value={addrForm.street} onChange={(e) => setAddr("street", e.target.value)} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="a-notes">{t("common.notes")}</Label>
              <Textarea
                id="a-notes"
                rows={2}
                placeholder={t("customer.profile.notesPlaceholder")}
                value={addrForm.notes}
                onChange={(e) => setAddr("notes", e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="a-default"
                checked={addrForm.isDefault}
                onCheckedChange={(v) => setAddr("isDefault", v === true)}
              />
              <Label htmlFor="a-default" className="font-normal">
                {t("customer.profile.setDefault")}
              </Label>
            </div>
          </div>

          <FieldError msg={addrErrs.form} />

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddrDialog(null)} disabled={addrBusy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={saveAddress} disabled={addrBusy}>
              {addrBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {addrDialog?.mode === "edit" ? t("customer.profile.saveAddress") : t("customer.profile.addAddress")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("customer.profile.deleteTitle", { label: deleteTarget?.label || "" })}</DialogTitle>
            <DialogDescription>{t("customer.profile.deleteDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={addrBusy}>
              {t("customer.profile.keep")}
            </Button>
            <Button variant="destructive" onClick={deleteAddress} disabled={addrBusy}>
              {addrBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

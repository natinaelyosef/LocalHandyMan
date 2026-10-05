"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, UserCircle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/client";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import { FieldError, errText } from "@/app/dashboard/customer/_lib/ui";

export default function AdminProfilePage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const { t } = useLocale();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

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

  const saveProfile = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (trimmedName.length < 2) {
      setProfileErr(t("admin.profile.nameRequired"));
      return;
    }
    if (!/^\+?\d{7,15}$/.test(trimmedPhone.replace(/[\s-]/g, ""))) {
      setProfileErr(t("admin.profile.phoneInvalid"));
      return;
    }
    setProfileBusy(true);
    setProfileErr("");
    try {
      await api("/api/profile", { method: "PATCH", body: { name: trimmedName, phone: trimmedPhone, gender } });
      await refresh();
      toast({ title: t("admin.profile.accountSaved") });
    } catch (e) {
      setProfileErr(errText(e, t));
    } finally {
      setProfileBusy(false);
    }
  };

  const changePassword = async () => {
    const e: Record<string, string> = {};
    if (!currentPw) e.currentPw = t("admin.profile.currentRequired");
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPw)) {
      e.newPw = t("admin.profile.newInvalid");
    }
    if (newPw !== confirmPw) e.confirmPw = t("admin.profile.confirmMismatch");
    setPwErrs(e);
    if (Object.keys(e).length) return;

    setPwBusy(true);
    try {
      await api("/api/profile", { method: "POST", body: { currentPassword: currentPw, newPassword: newPw } });
      toast({ title: t("admin.profile.passwordChanged") });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setPwErrs({ form: errText(err, t) });
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <DashboardShell role="admin" nav={ADMIN_NAV} title={t("admin.profile.title")} subtitle={t("admin.profile.subtitle")}>
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" /> {t("admin.profile.accountDetails")}
            </CardTitle>
            <CardDescription>{t("admin.profile.accountSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="a-name">{t("admin.profile.fullName")}</Label>
                <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-phone">{t("admin.profile.phone")}</Label>
                <Input id="a-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2519…" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-gender">{t("admin.profile.gender")}</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger id="a-gender">
                    <SelectValue placeholder={t("admin.profile.selectGender")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("admin.profile.male")}</SelectItem>
                    <SelectItem value="female">{t("admin.profile.female")}</SelectItem>
                    <SelectItem value="other">{t("admin.profile.otherGender")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="a-email">{t("admin.profile.email")}</Label>
                <Input id="a-email" value={user?.email || ""} disabled />
              </div>
            </div>

            <FieldError msg={profileErr} />

            <div className="flex justify-end">
              <Button onClick={saveProfile} disabled={profileBusy}>
                {profileBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("admin.profile.saveAccount")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> {t("admin.profile.changePassword")}
            </CardTitle>
            <CardDescription>{t("admin.profile.changePasswordDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="pw-current">{t("admin.profile.currentPassword")}</Label>
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
                <Label htmlFor="pw-new">{t("admin.profile.newPassword")}</Label>
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
                <Label htmlFor="pw-confirm">{t("admin.profile.confirmPassword")}</Label>
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

            <FieldError msg={pwErrs.form} />

            <div className="flex justify-end">
              <Button onClick={changePassword} disabled={pwBusy}>
                {pwBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("admin.profile.updatePassword")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

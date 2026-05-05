"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRoleLabel } from "@/lib/board-roles";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { BoardRole } from "@prisma/client";

type MeProfile = {
  id: string;
  name: string;
  email: string;
  role: BoardRole;
  roleLabelAr: string;
  roleLabelEn: string;
  positionCode: string | null;
  positionLabelAr: string | null;
  positionLabelEn: string | null;
  avatar: string | null;
};

export default function AccountPage() {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "ar" | "en";

  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<MeProfile | null>(null);

  const [name, setName] = React.useState("");
  const [savingProfile, setSavingProfile] = React.useState(false);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showCur, setShowCur] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [showConf, setShowConf] = React.useState(false);
  const [pwError, setPwError] = React.useState<string | null>(null);
  const [savingPw, setSavingPw] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (!res.ok) {
        toast.error(tCommon("errorOccurred"));
        return;
      }
      const data = (await res.json()) as MeProfile;
      setProfile(data);
      setName(data.name);
    } finally {
      setLoading(false);
    }
  }, [tCommon]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        toast.error(tCommon("errorOccurred"));
        return;
      }
      toast.success(t("profileUpdated"));
      await load();
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (!currentPassword.trim()) {
      setPwError(t("currentPasswordRequired"));
      return;
    }
    if (newPassword.length < 8) {
      setPwError(t("passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(t("passwordMismatch"));
      return;
    }

    setSavingPw(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (body.error === "Invalid current password") {
          setPwError(t("invalidCurrentPassword"));
        } else {
          setPwError(body.error ?? tCommon("errorOccurred"));
        }
        return;
      }
      toast.success(t("passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSavingPw(false);
    }
  }

  const roleLabel =
    locale === "ar" ? profile?.roleLabelAr : profile?.roleLabelEn;
  const positionLabel =
    locale === "ar"
      ? profile?.positionLabelAr ?? profile?.positionLabelEn
      : profile?.positionLabelEn ?? profile?.positionLabelAr;

  const initial = (
    profile?.name?.trim()?.[0] ??
    profile?.email?.[0] ??
    "?"
  ).toUpperCase();

  if (loading || !profile) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <Skeleton className="size-24 shrink-0 rounded-full" />
              <Skeleton className="h-12 w-full max-w-xs" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
            <div className="grid gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-48" />
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t pt-6">
            <Skeleton className="h-10 w-32" />
          </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="grid gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-full max-w-sm" />
          </CardContent>
          <CardFooter className="justify-end border-t pt-6">
            <Skeleton className="h-10 w-40" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("profileSection")}</CardTitle>
          <CardDescription>{t("profileSectionHint")}</CardDescription>
        </CardHeader>
        <form onSubmit={onSaveProfile}>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <Avatar className="size-24 text-lg">
                {profile.avatar ? (
                  <AvatarImage src={profile.avatar} alt="" />
                ) : null}
                <AvatarFallback className="text-2xl font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <p className="text-muted-foreground text-center text-sm sm:text-start">
                {t("avatarHint")}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-name">{t("name")}</Label>
              <Input
                id="acc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="grid gap-2">
              <Label>{tCommon("email")}</Label>
              <Input value={profile.email} readOnly disabled />
            </div>
            <div className="grid gap-2">
              <Label>{t("role")}</Label>
              <div>
                <Badge variant="secondary">
                  {roleLabel ?? getRoleLabel(profile.role, locale)}
                </Badge>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("position")}</Label>
              <p className="text-muted-foreground text-sm">
                {positionLabel?.trim() ? positionLabel : "—"}
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-end border-t pt-6">
            <Button type="submit" disabled={savingProfile || name.trim() === profile.name}>
              {savingProfile ? (
                <>
                  <Spinner className="me-2 size-4" />
                  {tCommon("loading")}
                </>
              ) : (
                t("saveProfile")
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("passwordSection")}</CardTitle>
          <CardDescription>{t("passwordSectionHint")}</CardDescription>
        </CardHeader>
        <form onSubmit={onChangePassword}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="acc-cur-pw">{t("currentPassword")}</Label>
              <div className="relative">
                <Input
                  id="acc-cur-pw"
                  type={showCur ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pe-10"
                />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground absolute end-0 top-0 flex h-full w-10 items-center justify-center rounded-e-md"
                  onClick={() => setShowCur((v) => !v)}
                  aria-label={showCur ? t("hidePassword") : t("showPassword")}
                >
                  {showCur ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-new-pw">{t("newPassword")}</Label>
              <div className="relative">
                <Input
                  id="acc-new-pw"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pe-10"
                  minLength={8}
                />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground absolute end-0 top-0 flex h-full w-10 items-center justify-center rounded-e-md"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? t("hidePassword") : t("showPassword")}
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-conf-pw">{t("confirmPassword")}</Label>
              <div className="relative">
                <Input
                  id="acc-conf-pw"
                  type={showConf ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pe-10"
                  minLength={8}
                />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground absolute end-0 top-0 flex h-full w-10 items-center justify-center rounded-e-md"
                  onClick={() => setShowConf((v) => !v)}
                  aria-label={showConf ? t("hidePassword") : t("showPassword")}
                >
                  {showConf ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">{t("passwordHint")}</p>
            {pwError ? (
              <p className="text-destructive text-sm" role="alert">
                {pwError}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="justify-end border-t pt-6">
            <Button type="submit" disabled={savingPw}>
              {savingPw ? (
                <>
                  <Spinner className="me-2 size-4" />
                  {tCommon("loading")}
                </>
              ) : (
                t("changePassword")
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

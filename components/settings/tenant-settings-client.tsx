"use client";

import type { Plan } from "@prisma/client";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardBreadcrumbs } from "@/components/layout/dashboard-breadcrumbs";
import { Link, useRouter } from "@/lib/i18n/routing";
import { uploadFile } from "@/lib/upload";
import { canManageTenantSettings } from "@/lib/tenant-settings-permission";
import { cn } from "@/lib/utils";
import { getTrialDaysRemaining } from "@/lib/trial";

type TenantUsage = {
  memberCount: number;
  memberLimit: number | null;
  meetingsThisMonth: number;
  meetingsPerMonthLimit: number | null;
};

type TenantPayload = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  plan: Plan;
  trialEndsAt: string | null;
  defaultLocale: string;
  createdAt: string;
  usage: TenantUsage;
};

function planBadgeClass(plan: Plan) {
  switch (plan) {
    case "TRIAL":
      return "border-amber-500/50 bg-amber-500/15 text-amber-950 dark:text-amber-100";
    case "STARTER":
      return "border-sky-500/50 bg-sky-500/15 text-sky-950 dark:text-sky-100";
    case "PROFESSIONAL":
      return "border-emerald-500/50 bg-emerald-500/15 text-emerald-950 dark:text-emerald-100";
    case "ENTERPRISE":
      return "border-violet-500/50 bg-violet-500/15 text-violet-950 dark:text-violet-100";
    default:
      return "";
  }
}

export function TenantSettingsClient() {
  const t = useTranslations("tenantSettings");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const { data: session, status } = useSession();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<TenantPayload | null>(null);
  const [name, setName] = useState("");
  const [defaultLocale, setDefaultLocale] = useState<"ar" | "en">("ar");
  const [logoDraft, setLogoDraft] = useState<string | null>(null);
  const [logoDirty, setLogoDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [deleteStep1Open, setDeleteStep1Open] = useState(false);
  const [deleteStep2Open, setDeleteStep2Open] = useState(false);
  const [confirmOrgName, setConfirmOrgName] = useState("");

  const tenantId = session?.user?.tenantId;

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoadError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}`, {
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as
        | TenantPayload
        | { error?: string };
      if (!res.ok) {
        setLoadError(
          typeof data === "object" && data && "error" in data
            ? String((data as { error?: string }).error)
            : tCommon("errorOccurred"),
        );
        return;
      }
      const row = data as TenantPayload;
      setTenant(row);
      setName(row.name);
      setDefaultLocale(row.defaultLocale === "en" ? "en" : "ar");
      setLogoDraft(row.logo);
      setLogoDirty(false);
    } catch {
      setLoadError(tCommon("errorOccurred"));
    }
  }, [tenantId, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  const allowed =
    status === "authenticated" &&
    session?.user &&
    canManageTenantSettings(session.user);

  async function onSave() {
    if (!tenantId || !tenant) return;
    if (name.trim().length < 2) {
      toast.error(t("saveNameInvalid"));
      return;
    }
    setSaving(true);
    try {
      const body: {
        name?: string;
        defaultLocale?: "ar" | "en";
        logo?: string | null;
      } = {
        name: name.trim(),
        defaultLocale,
      };
      if (logoDirty) {
        body.logo = logoDraft;
      }
      const res = await fetch(`/api/tenants/${tenantId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? tCommon("errorOccurred"));
        return;
      }
      toast.success(t("toastOrgUpdated"));
      setLogoDirty(false);
      router.refresh();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function onLogoFile(file: File | null) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const result = await uploadFile(file, "/ccos/logos");
      setLogoDraft(result.url);
      setLogoDirty(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tCommon("errorOccurred"));
    } finally {
      setUploadingLogo(false);
    }
  }

  function formatLimit(n: number | null) {
    if (n === null) return t("unlimited");
    return String(n);
  }

  if (status === "loading") {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (status === "authenticated" && !allowed) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">{t("accessDenied")}</p>
        <Button asChild className="mt-4" variant="outline" size="sm">
          <Link href="/dashboard">{t("backToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg text-sm text-destructive">
        {loadError}
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const displayLogo = logoDraft;

  const trialDaysRemaining =
    tenant.plan === "TRIAL" && tenant.trialEndsAt
      ? getTrialDaysRemaining({
          plan: tenant.plan,
          trialEndsAt: tenant.trialEndsAt,
        })
      : null;

  const trialEndsLabel =
    tenant.plan === "TRIAL" && tenant.trialEndsAt
      ? new Date(tenant.trialEndsAt).toLocaleDateString(
          locale === "ar" ? "ar-SA" : "en-US",
          { year: "numeric", month: "long", day: "numeric" },
        )
      : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <DashboardBreadcrumbs
        items={[
          { label: tNav("dashboard"), href: "/dashboard" },
          { label: t("pageTitle") },
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("pageSubtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("orgCardTitle")}</CardTitle>
          <CardDescription>{t("orgCardDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-2">
            <Label htmlFor="org-name">{t("orgNameLabel")}</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="organization"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="org-slug">{t("orgSlugLabel")}</Label>
            <Input
              id="org-slug"
              value={tenant.slug}
              readOnly
              className="bg-muted/60 text-muted-foreground"
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("orgLogoLabel")}</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
                {displayLogo ? (
                  <Image
                    src={displayLogo}
                    alt=""
                    fill
                    className="object-contain p-1"
                    sizes="96px"
                    unoptimized
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                    —
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() =>
                    document.getElementById("tenant-logo-input")?.click()
                  }
                >
                  {uploadingLogo ? (
                    <Loader2 className="me-2 size-4 animate-spin" />
                  ) : (
                    <Upload className="me-2 size-4" />
                  )}
                  {t("orgLogoUpload")}
                </Button>
                <input
                  id="tenant-logo-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    void onLogoFile(f ?? null);
                  }}
                />
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>{t("defaultLanguageLabel")}</Label>
            <Select
              value={defaultLocale}
              onValueChange={(v) => setDefaultLocale(v as "ar" | "en")}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">{t("langArabic")}</SelectItem>
                <SelectItem value="en">{t("langEnglish")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="button"
            className="bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            disabled={saving}
            onClick={() => void onSave()}
          >
            {saving ? (
              <>
                <Loader2 className="me-2 size-4 animate-spin" />
                {tCommon("loading")}
              </>
            ) : (
              tCommon("save")
            )}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>{t("planCardTitle")}</CardTitle>
            <CardDescription>{t("planCardDescription")}</CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn("shrink-0 font-semibold", planBadgeClass(tenant.plan))}
          >
            {tenant.plan === "TRIAL"
              ? t("planNameTrial")
              : tenant.plan === "STARTER"
                ? t("planNameStarter")
                : tenant.plan === "PROFESSIONAL"
                  ? t("planNameProfessional")
                  : t("planNameEnterprise")}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2 border-b border-border/60 pb-3">
            <span className="text-muted-foreground">{t("usageMembers")}</span>
            <span className="tabular-nums font-medium">
              {tenant.usage.memberCount} /{" "}
              {formatLimit(tenant.usage.memberLimit)}
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-muted-foreground">
              {t("usageMeetingsMonth")}
            </span>
            <span className="tabular-nums font-medium">
              {tenant.usage.meetingsThisMonth} /{" "}
              {formatLimit(tenant.usage.meetingsPerMonthLimit)}
            </span>
          </div>
          {tenant.plan === "TRIAL" && trialEndsLabel ? (
            <div className="text-muted-foreground space-y-1 border-b border-border/60 pb-3 text-sm">
              <p>
                <span className="font-medium text-foreground">
                  {t("trialEndsLabel")}
                </span>{" "}
                {trialEndsLabel}
              </p>
              {trialDaysRemaining !== null ? (
                <p>
                  <span className="font-medium text-foreground">
                    {t("trialDaysRemainingLabel")}
                  </span>{" "}
                  {t("trialDaysRemainingValue", { count: trialDaysRemaining })}
                </p>
              ) : null}
            </div>
          ) : null}
          {tenant.plan !== "ENTERPRISE" ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
              <p className="text-muted-foreground text-sm">
                {tenant.plan === "TRIAL"
                  ? t("upgradeHintTrial")
                  : t("upgradeHintPaid")}
              </p>
              <Button asChild className="mt-3" variant="secondary" size="sm">
                <Link href="/pricing" locale={locale}>
                  {t("upgradeCta")}
                </Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-destructive/50 shadow-none">
        <CardHeader>
          <CardTitle className="text-destructive">{t("dangerTitle")}</CardTitle>
          <CardDescription>{t("dangerDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setDeleteStep1Open(true)}
          >
            <Trash2 className="me-2 size-4" />
            {t("dangerDeleteButton")}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={deleteStep1Open} onOpenChange={setDeleteStep1Open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDeleteStep1Open(false);
                setConfirmOrgName("");
                setDeleteStep2Open(true);
              }}
            >
              {t("deleteContinue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={deleteStep2Open}
        onOpenChange={(open) => {
          setDeleteStep2Open(open);
          if (!open) setConfirmOrgName("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTypeTitle")}</DialogTitle>
            <DialogDescription>{t("deleteTypeDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="confirm-org">{t("deleteTypeLabel")}</Label>
            <Input
              id="confirm-org"
              value={confirmOrgName}
              onChange={(e) => setConfirmOrgName(e.target.value)}
              autoComplete="off"
              placeholder={tenant.name}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteStep2Open(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={confirmOrgName.trim() !== tenant.name.trim()}
              onClick={() => {
                setDeleteStep2Open(false);
                setConfirmOrgName("");
                toast.info(t("deletePlaceholderToast"));
              }}
            >
              {t("dangerDeleteButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

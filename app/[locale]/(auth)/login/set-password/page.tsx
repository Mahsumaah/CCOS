"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { CcosLogo } from "@/components/brand/ccos-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

type LoadState =
  | { status: "loading" }
  | { status: "no_token" }
  | { status: "invalid" }
  | { status: "ready"; name: string; email: string };

function AuthCardShell({
  children,
  footer,
  title,
  description,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  title: string;
  description?: string;
}) {
  const tCommon = useTranslations("common");
  const locale = useLocale() as "ar" | "en";
  const otherLocale = locale === "ar" ? "en" : "ar";

  return (
    <div
      className={cn(
        "flex min-h-svh flex-col items-center justify-center bg-gradient-to-br from-neutral-100 via-background to-neutral-50 p-4",
      )}
    >
      <Card className="w-full max-w-md rounded-xl border-border/80 shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-black/5">
              <CcosLogo maxHeight={60} className="mx-auto block" priority />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold tracking-tight">
              {title}
            </CardTitle>
            {description ? (
              <CardDescription className="text-muted-foreground">
                {description}
              </CardDescription>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
        <div className="border-t border-border/60 px-6 pb-6 text-center text-sm">
          {footer ?? (
            <Link
              href="/login"
              locale={otherLocale}
              className="text-secondary font-medium underline-offset-4 transition-colors hover:underline"
            >
              {locale === "ar" ? tCommon("langEnglish") : tCommon("langArabic")}
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}

function SetPasswordFormInner() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inlinePassword, setInlinePassword] = useState<string | null>(null);
  const [inlineConfirm, setInlineConfirm] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const token = searchParams.get("token")?.trim() ?? "";

  useEffect(() => {
    if (!token) {
      setLoad({ status: "no_token" });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/auth/validate-token?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        if (!res.ok) {
          setLoad({ status: "invalid" });
          return;
        }
        const data = (await res.json()) as { name?: string; email?: string };
        if (!data.name || !data.email) {
          setLoad({ status: "invalid" });
          return;
        }
        setLoad({
          status: "ready",
          name: data.name,
          email: data.email,
        });
      } catch {
        if (!cancelled) setLoad({ status: "invalid" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInlinePassword(null);
    setInlineConfirm(null);
    setSubmitError(null);

    if (password.length < 8) {
      setInlinePassword(t("setPasswordTooShort"));
      return;
    }
    if (password !== confirm) {
      setInlineConfirm(t("setPasswordMismatch"));
      return;
    }

    if (!token) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/set-board-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSubmitError(body.error ?? tCommon("errorOccurred"));
        return;
      }
      toast.success(t("setPasswordSuccessToast"));
      router.replace("/login");
      router.refresh();
    } catch {
      setSubmitError(tCommon("errorOccurred"));
    } finally {
      setSubmitting(false);
    }
  }

  if (load.status === "loading") {
    return (
      <AuthCardShell title={t("setPasswordTitle")}>
        <p className="text-muted-foreground text-center text-sm">
          {tCommon("loading")}
        </p>
      </AuthCardShell>
    );
  }

  if (load.status === "no_token") {
    return (
      <AuthCardShell title={t("setPasswordTitle")}>
        <div className="space-y-4">
          <p className="text-destructive text-center text-sm" role="alert">
            {t("setPasswordInvalidLink")}
          </p>
          <Button asChild className="w-full" variant="outline">
            <Link href="/login">{t("setPasswordBackToLogin")}</Link>
          </Button>
        </div>
      </AuthCardShell>
    );
  }

  if (load.status === "invalid") {
    return (
      <AuthCardShell title={t("setPasswordTitle")}>
        <div className="space-y-4">
          <p
            className="text-destructive text-center text-sm font-medium"
            role="alert"
          >
            {t("setPasswordExpiredTitle")}
          </p>
          <p className="text-muted-foreground text-center text-sm">
            {t("setPasswordExpiredHint")}
          </p>
          <Button asChild className="w-full" variant="outline">
            <Link href="/login">{t("setPasswordBackToLogin")}</Link>
          </Button>
        </div>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell
      title={t("setPasswordTitle")}
      description={t("setPasswordSubtitle")}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-center text-sm font-medium">
          {t("setPasswordWelcome", { name: load.name })}
        </p>
        <div className="space-y-2">
          <Label>{tCommon("email")}</Label>
          <Input value={load.email} readOnly disabled className="bg-muted/50" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">{t("newPassword")}</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pe-10"
              required
              minLength={8}
            />
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground absolute end-0 top-0 flex h-full w-10 items-center justify-center rounded-e-md"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <p className="text-muted-foreground text-xs">{t("setPasswordHint")}</p>
          {inlinePassword ? (
            <p className="text-destructive text-sm" role="alert">
              {inlinePassword}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="pe-10"
              required
              minLength={8}
            />
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground absolute end-0 top-0 flex h-full w-10 items-center justify-center rounded-e-md"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? t("hidePassword") : t("showPassword")}
            >
              {showConfirm ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {inlineConfirm ? (
            <p className="text-destructive text-sm" role="alert">
              {inlineConfirm}
            </p>
          ) : null}
        </div>
        {submitError ? (
          <p className="text-destructive text-sm" role="alert">
            {submitError}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          disabled={submitting}
        >
          {submitting ? tCommon("loading") : t("setPassword")}
        </Button>
      </form>
    </AuthCardShell>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-neutral-100 via-background to-neutral-50">
          <p className="text-muted-foreground text-sm">…</p>
        </div>
      }
    >
      <SetPasswordFormInner />
    </Suspense>
  );
}

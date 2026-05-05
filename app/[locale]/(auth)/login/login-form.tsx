"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
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

function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith("/") || path.includes("://") || path.startsWith("//")) {
    return false;
  }
  return /^\/(ar|en)(\/|$)/.test(path);
}

function LoginFormInner() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const otherLocale = locale === "ar" ? "en" : "ar";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInlineError(null);
    setSubmitting(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const callbackRaw = params.get("callbackUrl");

      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setInlineError(t("loginError"));
        toast.error(t("loginError"));
        setSubmitting(false);
        return;
      }

      if (res?.ok) {
        if (callbackRaw && isSafeInternalPath(callbackRaw)) {
          window.location.assign(callbackRaw);
          return;
        }
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setInlineError(t("loginError"));
      toast.error(t("loginError"));
    } catch {
      setInlineError(t("loginError"));
      toast.error(t("loginError"));
    } finally {
      setSubmitting(false);
    }
  }

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
              <CcosLogo maxHeight={72} className="mx-auto block" priority />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold tracking-tight">
              {t("loginTitle")}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t("loginSubtitle")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{tCommon("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{tCommon("password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pe-10"
                />
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground absolute end-0 top-0 flex h-full w-10 items-center justify-center rounded-e-md"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide" : "Show"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
            {inlineError ? (
              <p className="text-destructive text-sm" role="alert">
                {inlineError}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              disabled={submitting}
            >
              {submitting ? tCommon("loading") : t("loginButton")}
            </Button>
          </form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            {t("loginNoAccount")}{" "}
            <Link
              href="/register"
              className="text-secondary font-medium underline-offset-4 hover:underline"
            >
              {t("loginCreateAccountLink")}
            </Link>
          </p>
          <div className="mt-8 border-t border-border/60 pt-6 text-center text-sm">
            <Link
              href="/login"
              locale={otherLocale}
              className="text-secondary font-medium underline-offset-4 transition-colors hover:underline"
            >
              {locale === "ar" ? tCommon("langEnglish") : tCommon("langArabic")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-neutral-100 via-background to-neutral-50">
          <p className="text-muted-foreground text-sm">…</p>
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}

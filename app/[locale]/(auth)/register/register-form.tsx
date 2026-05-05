"use client";

import { Suspense, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/lib/i18n/routing";
import {
  buildRegisterFormSchema,
  type RegisterFormValues,
} from "@/lib/validations/register";
import { cn } from "@/lib/utils";

function RegisterFormInner() {
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const schema = useMemo(() => buildRegisterFormSchema(t), [t]);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      organizationName: "",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const otherLocale = locale === "ar" ? "en" : "ar";

  async function onSubmit(values: RegisterFormValues) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationName: values.organizationName,
        name: values.name,
        email: values.email,
        password: values.password,
        locale,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      success?: boolean;
    };

    if (!res.ok) {
      toast.error(data.error ?? tCommon("errorOccurred"));
      return;
    }

    const signRes = await signIn("credentials", {
      email: values.email.trim(),
      password: values.password,
      redirect: false,
    });

    if (signRes?.error) {
      toast.success(t("registerSuccessToast"));
      router.replace("/login");
      return;
    }

    toast.success(t("registerSuccessToast"));
    router.replace("/dashboard");
    router.refresh();
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
              <CcosLogo maxHeight={60} className="mx-auto block" priority />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold tracking-tight">
              {t("registerTitle")}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t("registerSubtitle")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="organizationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("registerOrganizationLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="organization"
                        placeholder={t(
                          "registerOrganizationPlaceholder",
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("registerYourNameLabel")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tCommon("email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tCommon("password")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          className="pe-10"
                          {...field}
                        />
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground absolute end-0 top-0 flex h-full w-10 items-center justify-center rounded-e-md"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={
                            showPassword
                              ? t("hidePassword")
                              : t("showPassword")
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormDescription>
                      {t("registerPasswordHelper")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("registerConfirmPasswordLabel")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirm ? "text" : "password"}
                          autoComplete="new-password"
                          className="pe-10"
                          {...field}
                        />
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground absolute end-0 top-0 flex h-full w-10 items-center justify-center rounded-e-md"
                          onClick={() => setShowConfirm((v) => !v)}
                          aria-label={
                            showConfirm
                              ? t("hidePassword")
                              : t("showPassword")
                          }
                        >
                          {showConfirm ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="me-2 size-4 animate-spin" />
                    {tCommon("loading")}
                  </>
                ) : (
                  t("registerSubmit")
                )}
              </Button>
            </form>
          </Form>
          <p className="text-muted-foreground mt-4 text-center text-sm">
            {t("registerHasAccount")}{" "}
            <Link
              href="/login"
              className="text-secondary font-medium underline-offset-4 hover:underline"
            >
              {t("registerSignInLink")}
            </Link>
          </p>
          <div className="mt-8 border-t border-border/60 pt-6 text-center text-sm">
            <Link
              href="/register"
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

export function RegisterForm() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center bg-gradient-to-br from-neutral-100 via-background to-neutral-50">
          <p className="text-muted-foreground text-sm">…</p>
        </div>
      }
    >
      <RegisterFormInner />
    </Suspense>
  );
}

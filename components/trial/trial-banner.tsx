"use client";

import type { Plan } from "@prisma/client";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/routing";
import { getTrialDaysRemaining, isTrialExpired } from "@/lib/trial";

export function TrialBanner({
  plan,
  trialEndsAtIso,
  locale,
}: {
  plan: Plan;
  trialEndsAtIso: string | null;
  locale: "ar" | "en";
}) {
  const t = useTranslations("trial");
  const tenant = {
    plan,
    trialEndsAt: trialEndsAtIso,
  };

  if (plan !== "TRIAL" || isTrialExpired(tenant)) return null;

  const days = getTrialDaysRemaining(tenant);

  return (
    <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-50">
      <Sparkles className="size-4" aria-hidden />
      <AlertTitle className="font-semibold">{t("bannerTitle")}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:text-amber-50">
        <span>
          {days === null
            ? t("bannerFallback")
            : t("bannerDays", { count: days })}
        </span>
        <Button size="sm" className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
          <Link href="/pricing" locale={locale}>
            {t("choosePlan")}
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

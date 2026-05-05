"use client";

import type { Plan } from "@prisma/client";
import { Lock } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { absolutizeCallbackUrl } from "@/lib/absolutize-callback-url";
import { Link } from "@/lib/i18n/routing";
import { isTrialExpired } from "@/lib/trial";

export function TrialExpiredOverlay({
  plan,
  trialEndsAtIso,
  locale,
}: {
  plan: Plan;
  trialEndsAtIso: string | null;
  locale: "ar" | "en";
}) {
  const t = useTranslations("trial");
  const tenant = { plan, trialEndsAt: trialEndsAtIso };

  if (plan !== "TRIAL" || !isTrialExpired(tenant)) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
    >
      <Card className="max-w-md border-destructive/30 shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <Lock className="size-8" aria-hidden />
          </div>
          <CardTitle id="trial-expired-title" className="pt-2 text-xl">
            {t("expiredTitle")}
          </CardTitle>
          <CardDescription className="text-base">
            {t("expiredMessage")}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto" asChild>
            <Link href="/pricing" locale={locale}>
              {t("viewPlans")}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() =>
              void signOut({
                callbackUrl: absolutizeCallbackUrl(`/${locale}/login`),
              })
            }
          >
            {t("logout")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

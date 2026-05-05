"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

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
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

function FeatureLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-muted-foreground flex gap-2 text-sm">
      <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export function MarketingPricingSection({
  showWhatIs,
}: {
  /** When true, renders the “What is CCOS?” block (standalone pricing page). */
  showWhatIs?: boolean;
}) {
  const t = useTranslations("marketing.pricing");

  return (
    <div className="space-y-10">
      <div className="mx-auto max-w-6xl px-4 text-center md:px-6">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
          {t("sectionTitle")}
        </h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-sm md:text-base">
          {t("sectionSubtitle")}
        </p>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-stretch gap-6 px-4 md:grid-cols-2 md:px-6 lg:grid-cols-3 lg:gap-8">
        <Card className="border-border/80 flex flex-col shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">{t("starter.name")}</CardTitle>
            <p className="text-2xl font-bold tabular-nums md:text-3xl">
              {t("starter.price")}
            </p>
            <CardDescription>{t("starter.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="flex flex-col gap-2">
              {(
                [
                  "starter.f1",
                  "starter.f2",
                  "starter.f3",
                  "starter.f4",
                  "starter.f5",
                  "starter.f6",
                ] as const
              ).map((k) => (
                <FeatureLine key={k}>{t(k)}</FeatureLine>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              asChild
            >
              <Link href="/register">{t("starter.cta")}</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card
          className={cn(
            "relative flex flex-col border-primary shadow-xl md:col-span-2 lg:col-span-1 lg:z-10 lg:-my-2 lg:scale-[1.02]",
            "ring-primary ring-2",
          )}
        >
          <Badge className="bg-primary text-primary-foreground absolute -top-3 start-1/2 z-10 -translate-x-1/2 px-3">
            {t("professional.badge")}
          </Badge>
          <CardHeader className="pt-8">
            <CardTitle className="text-xl">{t("professional.name")}</CardTitle>
            <p className="text-muted-foreground text-lg line-through">
              {t("professional.priceWas")}
            </p>
            <p className="text-2xl font-bold tabular-nums md:text-3xl">
              {t("professional.price")}
            </p>
            <Badge variant="secondary" className="w-fit">
              {t("professional.offerBadge")}
            </Badge>
            <CardDescription className="pt-1">
              {t("professional.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="flex flex-col gap-2">
              {(
                [
                  "professional.f1",
                  "professional.f2",
                  "professional.f3",
                  "professional.f4",
                  "professional.f5",
                  "professional.f6",
                  "professional.f7",
                  "professional.f8",
                ] as const
              ).map((k) => (
                <FeatureLine key={k}>{t(k)}</FeatureLine>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
              asChild
            >
              <Link href="/register">{t("professional.cta")}</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-border/80 flex flex-col shadow-sm md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-xl">{t("enterprise.name")}</CardTitle>
            <p className="text-2xl font-bold tabular-nums md:text-3xl">
              {t("enterprise.price")}
            </p>
            <CardDescription>{t("enterprise.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="flex flex-col gap-2">
              {(
                [
                  "enterprise.f1",
                  "enterprise.f2",
                  "enterprise.f3",
                  "enterprise.f4",
                  "enterprise.f5",
                  "enterprise.f6",
                  "enterprise.f7",
                ] as const
              ).map((k) => (
                <FeatureLine key={k}>{t(k)}</FeatureLine>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full font-semibold" asChild>
              <a href="mailto:sales@mahsumaah.sa">{t("enterprise.cta")}</a>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Card className="border-border/60 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">
              {t("addons.title")}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed md:text-base">
              {t("addons.body")}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {showWhatIs ? (
        <div className="mx-auto max-w-3xl space-y-4 px-4 md:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
            {t("whatTitle")}
          </h2>
          <p className="text-muted-foreground text-center text-sm leading-relaxed md:text-base">
            {t("whatBody")}
          </p>
        </div>
      ) : null}
    </div>
  );
}

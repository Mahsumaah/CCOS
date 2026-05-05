"use client";

import {
  CalendarDays,
  CalendarPlus,
  CheckCircle,
  FileCheck,
  FileText,
  Globe,
  PenTool,
  Shield,
  UserPlus,
  Users,
  Vote,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MarketingPricingSection } from "@/components/marketing/marketing-pricing-section";
import { MarketingReveal } from "@/components/marketing/marketing-reveal";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CalendarDays;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-border/80 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0">
      <CardHeader className="space-y-3">
        <div className="text-primary flex size-12 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-7" strokeWidth={1.75} />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function DemoMockup() {
  return (
    <Card className="border-border/80 overflow-hidden shadow-xl">
      <CardContent className="p-0">
        <div className="flex min-h-[220px] md:min-h-[280px]">
          <div className="hidden w-[22%] shrink-0 border-e border-border/80 bg-muted/80 p-3 sm:flex sm:flex-col sm:gap-2">
            <div className="h-2 w-10 rounded bg-muted-foreground/20" />
            <div className="h-2 w-full rounded bg-muted-foreground/15" />
            <div className="h-2 w-full rounded bg-muted-foreground/15" />
            <div className="h-2 w-[75%] rounded bg-muted-foreground/15" />
            <div className="mt-4 h-2 w-full rounded bg-primary/30" />
            <div className="h-2 w-full rounded bg-muted-foreground/10" />
            <div className="h-2 w-full rounded bg-muted-foreground/10" />
          </div>
          <div className="relative flex-1 bg-gradient-to-br from-neutral-50 via-background to-neutral-100 p-4 md:p-6 dark:from-neutral-900 dark:via-background dark:to-neutral-950">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="h-8 flex-1 max-w-md rounded-md bg-white/80 shadow-sm ring-1 ring-black/5 dark:bg-neutral-800/80" />
              <div className="h-8 w-20 rounded-md bg-primary/90" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="h-24 rounded-lg border border-border/60 bg-white/70 shadow-sm dark:bg-neutral-800/60" />
              <div className="h-24 rounded-lg border border-border/60 bg-white/70 shadow-sm dark:bg-neutral-800/60" />
              <div className="h-24 rounded-lg border border-border/60 bg-white/70 shadow-sm dark:bg-neutral-800/60 sm:col-span-1" />
            </div>
            <div className="mt-4 h-32 rounded-lg border border-dashed border-primary/30 bg-primary/5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MarketingLanding() {
  const tHero = useTranslations("marketing.hero");
  const tStats = useTranslations("marketing.stats");
  const tFeat = useTranslations("marketing.features");
  const tHow = useTranslations("marketing.how");
  const tFaq = useTranslations("marketing.faq");

  const features = [
    { icon: CalendarDays, titleKey: "f1Title", descKey: "f1Desc" },
    { icon: Vote, titleKey: "f2Title", descKey: "f2Desc" },
    { icon: FileCheck, titleKey: "f3Title", descKey: "f3Desc" },
    { icon: FileText, titleKey: "f4Title", descKey: "f4Desc" },
    { icon: PenTool, titleKey: "f5Title", descKey: "f5Desc" },
    { icon: Shield, titleKey: "f6Title", descKey: "f6Desc" },
    { icon: Users, titleKey: "f7Title", descKey: "f7Desc" },
    { icon: Globe, titleKey: "f8Title", descKey: "f8Desc" },
  ] as const;

  return (
    <>
      <section className="relative overflow-hidden pt-24 pb-16 md:pt-28 md:pb-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,210,0,0.22),transparent)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
            <Badge
              variant="secondary"
              className="mb-6 border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-foreground"
            >
              {tHero("badge")}
            </Badge>
            <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-[2.75rem] lg:leading-[1.15]">
              {tHero("title")}
            </h1>
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-pretty text-base md:text-lg">
              {tHero("subtitle")}
            </p>
            <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                className="h-12 min-w-[200px] bg-primary px-8 text-base font-semibold text-primary-foreground shadow-md hover:bg-primary/90 sm:h-14"
                asChild
              >
                <Link href="/register">{tHero("ctaPrimary")}</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 min-w-[200px] text-base sm:h-14" asChild>
                <a href="#how-it-works">{tHero("ctaSecondary")}</a>
              </Button>
            </div>
            <p className="text-muted-foreground mt-4 text-sm">{tHero("noCard")}</p>
          </div>
          <div className="mx-auto mt-14 max-w-5xl md:mt-20">
            <DemoMockup />
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-muted/40 py-12 md:py-14">
        <MarketingReveal className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
          {(
            [
              ["v1", "l1"],
              ["v2", "l2"],
              ["v3", "l3"],
              ["v4", "l4"],
            ] as const
          ).map(([vk, lk]) => (
            <div key={vk} className="text-center">
              <p className="text-primary text-2xl font-bold tabular-nums md:text-3xl">
                {tStats(vk)}
              </p>
              <p className="text-muted-foreground mt-1 text-sm font-medium md:text-base">
                {tStats(lk)}
              </p>
            </div>
          ))}
          </div>
        </MarketingReveal>
      </section>

      <section id="features" className="scroll-mt-24 py-16 md:py-24">
        <MarketingReveal className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
            {tFeat("sectionTitle")}
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon, titleKey, descKey }) => (
              <FeatureCard
                key={titleKey}
                icon={icon}
                title={tFeat(titleKey)}
                description={tFeat(descKey)}
              />
            ))}
          </div>
        </MarketingReveal>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-24 border-t border-border/60 bg-muted/30 py-16 md:py-24"
      >
        <MarketingReveal className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
            {tHow("sectionTitle")}
          </h2>
          <div className="relative mt-14 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-6">
            <div
              aria-hidden
              className="absolute start-[16%] end-[16%] top-8 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
            />
            {(
              [
                {
                  icon: UserPlus,
                  title: tHow("step1Title"),
                  desc: tHow("step1Desc"),
                },
                {
                  icon: CalendarPlus,
                  title: tHow("step2Title"),
                  desc: tHow("step2Desc"),
                },
                {
                  icon: CheckCircle,
                  title: tHow("step3Title"),
                  desc: tHow("step3Desc"),
                },
              ] as const
            ).map((step, i) => (
              <div key={i} className="relative flex flex-col items-center text-center">
                <div className="text-primary relative z-10 flex size-16 items-center justify-center rounded-full border-2 border-primary/40 bg-background shadow-md">
                  <step.icon className="size-8" strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-2 max-w-xs text-sm leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </MarketingReveal>
      </section>

      <section id="pricing" className="scroll-mt-24 py-16 md:py-24">
        <MarketingReveal>
          <MarketingPricingSection />
        </MarketingReveal>
      </section>

      <section id="faq" className="scroll-mt-24 border-t border-border/60 bg-muted/30 py-16 md:py-24">
        <MarketingReveal className="mx-auto max-w-3xl px-4 md:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight md:text-3xl">
            {tFaq("sectionTitle")}
          </h2>
          <Accordion type="single" collapsible className="mt-10 w-full">
            {(
              [
                ["q1", "a1"],
                ["q2", "a2"],
                ["q3", "a3"],
                ["q4", "a4"],
                ["q5", "a5"],
                ["q6", "a6"],
              ] as const
            ).map(([qk, ak]) => (
              <AccordionItem key={qk} value={qk}>
                <AccordionTrigger className="text-start rtl:text-end">
                  {tFaq(qk)}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {tFaq(ak)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </MarketingReveal>
      </section>
    </>
  );
}

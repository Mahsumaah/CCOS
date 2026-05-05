"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export type MinutesWorkflowStepperProps = {
  locale: "ar" | "en";
  hasMinutesRow: boolean;
  reviewSaved: boolean;
  isFinalized: boolean;
  hasSignatures: boolean;
  isAdopted: boolean;
  attendeesNotified: boolean;
};

export function MinutesWorkflowStepper({
  locale,
  hasMinutesRow,
  reviewSaved,
  isFinalized,
  hasSignatures,
  isAdopted,
  attendeesNotified,
}: MinutesWorkflowStepperProps) {
  const t = useTranslations("minutes");

  const steps = [
    { key: "gen", label: t("workflowGenerate"), done: hasMinutesRow },
    {
      key: "rev",
      label: t("workflowReview"),
      done: reviewSaved || isFinalized,
    },
    { key: "fin", label: t("workflowFinalize"), done: Boolean(isFinalized) },
    { key: "sig", label: t("workflowSign"), done: hasSignatures },
    { key: "adp", label: t("workflowAdopt"), done: isAdopted },
    { key: "ntf", label: t("workflowNotify"), done: attendeesNotified },
  ];

  const firstOpen = steps.findIndex((s) => !s.done);
  const currentIndex = firstOpen === -1 ? steps.length - 1 : firstOpen;

  return (
    <ol
      className="border-border bg-muted/30 flex flex-wrap items-stretch gap-2 rounded-lg border p-3 sm:gap-1"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      {steps.map((step, i) => {
        const isCurrent = i === currentIndex && !step.done;
        const isPast = step.done;
        return (
          <li
            key={step.key}
            className="flex min-w-[calc(50%-0.25rem)] flex-1 flex-col gap-1 sm:min-w-0 sm:flex-1"
          >
            <div
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:flex-col sm:items-center sm:gap-1 sm:px-1 sm:py-2",
                isPast && "text-muted-foreground",
                isCurrent &&
                  "bg-primary/15 text-foreground ring-primary/40 ring-1",
                !isPast &&
                  !isCurrent &&
                  "text-muted-foreground/80",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums",
                  isPast &&
                    "border-primary bg-primary text-primary-foreground",
                  isCurrent &&
                    "border-primary bg-background text-foreground shadow-sm",
                  !isPast &&
                    !isCurrent &&
                    "border-muted-foreground/30 bg-background",
                )}
              >
                {isPast ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <span aria-hidden>{i + 1}</span>
                )}
              </span>
              <span className="line-clamp-2 text-center leading-tight sm:min-h-[2.5rem] sm:px-0.5">
                {step.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

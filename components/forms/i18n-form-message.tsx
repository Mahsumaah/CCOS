"use client";

import { useTranslations } from "next-intl";

import { useFormField } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/** Zod `message` values that map to `meetings` translation keys. */
export const MEETINGS_FORM_ERROR_KEYS = new Set([
  "validationTitleRequired",
  "validationAgendaAtLeastOneTitleAr",
  "validationAgendaMinRows",
  "validationAgendaTitleArRequired",
  "validationCustomMeetingTypeRequired",
  "validationDurationMin",
  "validationDurationMax",
  "validationGuestEmailItem",
]);

export function translateMeetingsFormError(
  msg: string,
  t: (key: string) => string,
): string {
  return MEETINGS_FORM_ERROR_KEYS.has(msg) ? t(msg) : msg;
}

export function I18nFormMessage({
  namespace = "meetings",
  className,
}: {
  namespace?: "meetings";
  className?: string;
}) {
  const { error, formMessageId } = useFormField();
  const t = useTranslations(namespace);

  if (!error?.message) return null;

  const msg = String(error.message);
  const text = MEETINGS_FORM_ERROR_KEYS.has(msg) ? t(msg) : msg;

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-destructive text-sm", className)}
    >
      {text}
    </p>
  );
}

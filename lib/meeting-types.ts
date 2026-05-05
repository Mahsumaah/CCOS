import { MeetingType } from "@prisma/client";

export const MEETING_TYPES = Object.values(MeetingType).filter(
  (v): v is MeetingType => typeof v === "string",
);

export const MEETING_TYPE_LABELS_AR: Record<MeetingType, string> = {
  BOARD: "مجلس إدارة",
  EMERGENCY: "طارئ",
  ASSEMBLY: "جمعية عمومية",
  EXECUTIVE_COMMITTEE: "لجنة تنفيذية",
  TECHNICAL_COMMITTEE: "لجنة فنية",
  FINANCIAL_COMMITTEE: "لجنة مالية",
  STRATEGIC: "استراتيجي",
};

export const MEETING_TYPE_LABELS_EN: Record<MeetingType, string> = {
  BOARD: "Board Meeting",
  EMERGENCY: "Emergency",
  ASSEMBLY: "General Assembly",
  EXECUTIVE_COMMITTEE: "Executive Committee",
  TECHNICAL_COMMITTEE: "Technical Committee",
  FINANCIAL_COMMITTEE: "Financial Committee",
  STRATEGIC: "Strategic",
};

export type MeetingTypeLabelLocale = "ar" | "en";

export function getMeetingTypeLabel(
  type: MeetingType,
  locale: MeetingTypeLabelLocale,
): string {
  return locale === "ar"
    ? MEETING_TYPE_LABELS_AR[type]
    : MEETING_TYPE_LABELS_EN[type];
}

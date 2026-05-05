import type { MeetingStatus } from "@prisma/client";

export type MeetingStatusLocale = "ar" | "en";

export type MeetingStatusBadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline";

const LABELS_AR: Record<MeetingStatus, string> = {
  SCHEDULED: "قادم",
  LIVE: "جارٍ الآن",
  ENDED: "منتهٍ",
  ARCHIVED: "مؤرشف",
  CANCELLED: "ملغي",
};

const LABELS_EN: Record<MeetingStatus, string> = {
  SCHEDULED: "Upcoming",
  LIVE: "Live",
  ENDED: "Ended",
  ARCHIVED: "Archived",
  CANCELLED: "Cancelled",
};

export function getStatusLabel(
  status: MeetingStatus,
  locale: MeetingStatusLocale,
): string {
  return locale === "ar" ? LABELS_AR[status] : LABELS_EN[status];
}

export function getStatusVariant(
  status: MeetingStatus,
): MeetingStatusBadgeVariant {
  switch (status) {
    case "SCHEDULED":
      return "secondary";
    case "LIVE":
      return "outline";
    case "ENDED":
      return "outline";
    case "ARCHIVED":
      return "outline";
    case "CANCELLED":
      return "destructive";
    default:
      return "outline";
  }
}

/** Extra classes for Badge when variant alone is not enough (e.g. LIVE pulse). */
export function getStatusBadgeClassName(status: MeetingStatus): string {
  switch (status) {
    case "LIVE":
      return "border-transparent bg-green-600 text-white shadow-sm animate-pulse hover:bg-green-600";
    case "ARCHIVED":
      return "border-transparent bg-slate-600 text-white hover:bg-slate-600";
    case "ENDED":
      return "border-border text-muted-foreground";
    case "CANCELLED":
      return "border-transparent bg-red-600 text-white hover:bg-red-600";
    default:
      return "";
  }
}

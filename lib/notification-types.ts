import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarPlus,
  FileCheck,
  FileText,
  Lock,
  PenTool,
  Play,
  Square,
  Vote,
} from "lucide-react";

export const NOTIFICATION_TYPES = [
  "MEETING_INVITE",
  "MEETING_STARTED",
  "MEETING_ENDED",
  "VOTE_OPENED",
  "VOTE_CLOSED",
  "DECISION_CREATED",
  "MINUTES_READY",
  "MINUTES_SIGNED",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const CONFIG: Record<
  NotificationType,
  { labelAr: string; labelEn: string; icon: LucideIcon }
> = {
  MEETING_INVITE: {
    labelAr: "دعوة اجتماع",
    labelEn: "Meeting Invitation",
    icon: CalendarPlus,
  },
  MEETING_STARTED: {
    labelAr: "بدأ الاجتماع",
    labelEn: "Meeting Started",
    icon: Play,
  },
  MEETING_ENDED: {
    labelAr: "انتهى الاجتماع",
    labelEn: "Meeting Ended",
    icon: Square,
  },
  VOTE_OPENED: {
    labelAr: "تصويت جديد",
    labelEn: "New Vote",
    icon: Vote,
  },
  VOTE_CLOSED: {
    labelAr: "أُغلق التصويت",
    labelEn: "Vote Closed",
    icon: Lock,
  },
  DECISION_CREATED: {
    labelAr: "قرار جديد",
    labelEn: "New Decision",
    icon: FileCheck,
  },
  MINUTES_READY: {
    labelAr: "المحضر جاهز",
    labelEn: "Minutes Ready",
    icon: FileText,
  },
  MINUTES_SIGNED: {
    labelAr: "تم التوقيع على المحضر",
    labelEn: "Minutes Signed",
    icon: PenTool,
  },
};

const FALLBACK = {
  labelAr: "إشعار",
  labelEn: "Notification",
  icon: Bell,
};

export function getNotificationConfig(
  type: string,
  locale: "ar" | "en",
): { label: string; Icon: LucideIcon } {
  const entry = CONFIG[type as NotificationType] ?? FALLBACK;
  return {
    label: locale === "ar" ? entry.labelAr : entry.labelEn,
    Icon: entry.icon,
  };
}

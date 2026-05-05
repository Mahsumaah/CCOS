import type { BoardRole } from "@prisma/client";

/** Stable order for role selects and filters. */
export const BOARD_ROLES: BoardRole[] = [
  "CHAIR",
  "VICE_CHAIR_1",
  "VICE_CHAIR_2",
  "VICE_CHAIR_3",
  "VICE_CHAIR_4",
  "SECRETARY_GENERAL",
  "ASSISTANT_SECRETARY_GENERAL",
  "MEMBER",
  "MINUTES_CLERK",
  "TREASURER",
  "SUPERVISOR",
  "VIEWER",
];

export const BOARD_ROLE_LABELS_AR: Record<BoardRole, string> = {
  CHAIR: "رئيس المجلس",
  VICE_CHAIR_1: "نائب الرئيس الأول",
  VICE_CHAIR_2: "نائب الرئيس الثاني",
  VICE_CHAIR_3: "نائب الرئيس الثالث",
  VICE_CHAIR_4: "نائب الرئيس الرابع",
  MEMBER: "عضو",
  SECRETARY_GENERAL: "أمين عام",
  ASSISTANT_SECRETARY_GENERAL: "أمين عام مساعد",
  SUPERVISOR: "مراقب",
  MINUTES_CLERK: "أمين سر",
  TREASURER: "أمين صندوق",
  VIEWER: "مشاهد",
};

export const BOARD_ROLE_LABELS_EN: Record<BoardRole, string> = {
  CHAIR: "Chair",
  VICE_CHAIR_1: "First Vice Chair",
  VICE_CHAIR_2: "Second Vice Chair",
  VICE_CHAIR_3: "Third Vice Chair",
  VICE_CHAIR_4: "Fourth Vice Chair",
  MEMBER: "Member",
  SECRETARY_GENERAL: "Secretary General",
  ASSISTANT_SECRETARY_GENERAL: "Assistant Secretary General",
  SUPERVISOR: "Supervisor",
  MINUTES_CLERK: "Minutes Clerk",
  TREASURER: "Treasurer",
  VIEWER: "Viewer",
};

export type RoleLabelLocale = "ar" | "en";

export function getRoleLabel(role: BoardRole, locale: RoleLabelLocale): string {
  return locale === "ar"
    ? BOARD_ROLE_LABELS_AR[role]
    : BOARD_ROLE_LABELS_EN[role];
}

/** Sidebar / compact role badge colors (Tailwind classes, no variant). */
export function sidebarRoleBadgeClassName(role: BoardRole): string {
  switch (role) {
    case "CHAIR":
      return "border-0 bg-[#FFD200] text-black shadow-sm hover:bg-[#e6bd00]";
    case "SECRETARY_GENERAL":
      return "border-0 bg-blue-600 text-white shadow-sm hover:bg-blue-600/90";
    case "MEMBER":
      return "border-0 bg-muted text-foreground hover:bg-muted/80";
    case "VIEWER":
      return "border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-muted/50";
    default:
      return "border-0 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90";
  }
}

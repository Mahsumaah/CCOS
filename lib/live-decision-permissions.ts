import type { MeetingLiveRole } from "@prisma/client";

export function canApproveOrRejectLiveDecision(role: MeetingLiveRole): boolean {
  return role === "CHAIR" || role === "SECRETARY";
}

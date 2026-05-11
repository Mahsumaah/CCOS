import type { MeetingLiveRole } from "@prisma/client";

/** Roles that may see individual ballots for SECRET votes (open or closed). */
export function canViewSecretLiveVoteBallots(role: MeetingLiveRole): boolean {
  return role === "CHAIR" || role === "SECRETARY";
}

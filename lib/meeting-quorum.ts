import type {
  MeetingType,
  MeetingTypeQuorumPolicy,
  QuorumRuleMode,
} from "@prisma/client";
import { InvitationStatus } from "@prisma/client";

export type QuorumDTO = {
  required: boolean;
  met: boolean;
  mode: QuorumRuleMode;
  threshold: number;
  current: number;
  total: number;
  percentage: number;
};

type PolicyFields = Pick<
  MeetingTypeQuorumPolicy,
  "quorumRequired" | "ruleMode" | "minAttendancePercent"
>;

export type QuorumInvitationRow = {
  userId: string;
  status: InvitationStatus;
  attendanceCheckedInAt: Date | string | null;
};

export type QuorumDelegationRow = {
  fromUserId: string;
  toUserId: string;
  revokedAt: Date | string | null;
};

/**
 * Counts invitees considered present for quorum: accepted or checked in,
 * plus delegators whose proxy (delegatee) is directly present (any active delegation).
 */
export function countQuorumAttendance(
  invitations: QuorumInvitationRow[],
  delegations: QuorumDelegationRow[] = [],
): number {
  const direct = new Set<string>();
  for (const inv of invitations) {
    if (
      inv.attendanceCheckedInAt != null ||
      inv.status === InvitationStatus.ACCEPTED
    ) {
      direct.add(inv.userId);
    }
  }
  const present = new Set(direct);
  for (const d of delegations) {
    if (d.revokedAt != null) continue;
    if (direct.has(d.toUserId)) {
      present.add(d.fromUserId);
    }
  }
  return present.size;
}

function ceilDiv(n: number, d: number): number {
  return Math.ceil(n / d);
}

function defaultPolicy(_meetingType: MeetingType): PolicyFields {
  return {
    quorumRequired: true,
    ruleMode: "ABSOLUTE_MAJORITY",
    minAttendancePercent: null,
  };
}

/**
 * Computes quorum threshold and whether it is met for a live meeting.
 */
export function calculateQuorum(params: {
  meetingType: MeetingType;
  policy: PolicyFields | null;
  totalInvited: number;
  attendedCount: number;
}): QuorumDTO {
  const { totalInvited, attendedCount: current } = params;
  const policy = params.policy ?? defaultPolicy(params.meetingType);
  const mode = policy.ruleMode;
  const required = Boolean(policy.quorumRequired);

  const total = totalInvited;
  const percentage =
    total > 0 ? Math.round((current / total) * 1000) / 10 : 0;

  if (!required) {
    return {
      required: false,
      met: true,
      mode,
      threshold: 0,
      current,
      total,
      percentage,
    };
  }

  if (total === 0) {
    return {
      required: true,
      met: true,
      mode,
      threshold: 0,
      current,
      total,
      percentage,
    };
  }

  let threshold: number;
  switch (mode) {
    case "ABSOLUTE_MAJORITY":
      threshold = Math.floor(total / 2) + 1;
      break;
    case "TWO_THIRDS":
      threshold = ceilDiv(total * 2, 3);
      break;
    case "MIN_PERCENT": {
      const pct = policy.minAttendancePercent ?? 50;
      const clamped = Math.min(100, Math.max(1, pct));
      threshold = ceilDiv(total * clamped, 100);
      break;
    }
    default:
      threshold = Math.floor(total / 2) + 1;
  }

  threshold = Math.max(0, Math.min(threshold, total));
  const met = current >= threshold;

  return {
    required: true,
    met,
    mode,
    threshold,
    current,
    total,
    percentage,
  };
}

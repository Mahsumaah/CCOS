import type { BoardRole, LiveVoteChoice, LiveVoteRule, MeetingLiveRole } from "@prisma/client";
import { InvitationStatus } from "@prisma/client";

import { boardRoleToLiveRole } from "@/lib/live-permissions";
import {
  calculateQuorum,
  countQuorumAttendance,
  type QuorumDelegationRow,
  type QuorumInvitationRow,
} from "@/lib/meeting-quorum";
import type {
  MeetingType,
  MeetingTypeQuorumPolicy,
  QuorumRuleMode,
} from "@prisma/client";

/** Quorum check for live session (invited users currently in the room). */
export function evaluateLiveQuorumSnapshot(params: {
  meetingType: MeetingType;
  policy: Pick<
    MeetingTypeQuorumPolicy,
    "quorumRequired" | "ruleMode" | "minAttendancePercent"
  > | null;
  invitations: QuorumInvitationRow[];
  delegations: QuorumDelegationRow[];
  livePresentUserIds: string[];
}) {
  const { meetingType, policy, invitations, delegations, livePresentUserIds } = params;
  const totalInvited = invitations.length;
  const liveSet = new Set(livePresentUserIds);
  const liveInviteeRows: QuorumInvitationRow[] = invitations
    .filter((i) => liveSet.has(i.userId))
    .map((i) => ({
      userId: i.userId,
      status: InvitationStatus.ACCEPTED,
      attendanceCheckedInAt: i.attendanceCheckedInAt ?? new Date(),
    }));
  const attendedCount = countQuorumAttendance(liveInviteeRows, delegations);
  return calculateQuorum({
    meetingType,
    policy,
    totalInvited,
    attendedCount,
  });
}

const DEFAULT_ROLE_WEIGHT: Record<MeetingLiveRole, number> = {
  CHAIR: 1,
  VICE_CHAIR: 1,
  SECRETARY: 1,
  DECISION_RECORDER: 1,
  VOTING_MEMBER: 1,
  NON_VOTING_MEMBER: 1,
  OBSERVER: 0,
  GUEST: 0,
  SYSTEM_ADMIN: 1,
};

export type BallotForResult = {
  choice: LiveVoteChoice;
  user: { role: BoardRole };
};

export type LiveVoteResultPayload = {
  yes: number;
  no: number;
  abstain: number;
  total: number;
  totalWeightedBallots: number;
  weightedYes: number;
  weightedNo: number;
  weightedAbstain: number;
  rule: LiveVoteRule;
  quorum?: {
    required: boolean;
    met: boolean;
    mode: QuorumRuleMode;
    threshold: number;
    current: number;
    total: number;
    percentage: number;
  };
  outcome: "PASSED" | "FAILED" | "TIE" | "NO_QUORUM";
  explanationKey: "majorityPassed" | "majorityFailed" | "tie" | "weightedPassed" | "weightedFailed" | "noQuorum";
};

function roleWeight(role: MeetingLiveRole): number {
  return DEFAULT_ROLE_WEIGHT[role] ?? 1;
}

export function buildLiveVoteResult(params: {
  rule: LiveVoteRule;
  ballots: BallotForResult[];
  quorumContext?: {
    meetingType: MeetingType;
    policy: Pick<
      MeetingTypeQuorumPolicy,
      "quorumRequired" | "ruleMode" | "minAttendancePercent"
    > | null;
    invitations: QuorumInvitationRow[];
    delegations: QuorumDelegationRow[];
    /** Live participants currently in session (distinct users). */
    livePresentUserIds: string[];
  };
}): LiveVoteResultPayload {
  const { rule, ballots } = params;
  let yes = 0;
  let no = 0;
  let abstain = 0;
  let weightedYes = 0;
  let weightedNo = 0;
  let weightedAbstain = 0;
  let totalWeightedBallots = 0;

  for (const b of ballots) {
    const lr = boardRoleToLiveRole(b.user.role);
    const w = roleWeight(lr);
    if (w <= 0) continue;
    totalWeightedBallots += w;
    if (b.choice === "YES") {
      yes += 1;
      weightedYes += w;
    } else if (b.choice === "NO") {
      no += 1;
      weightedNo += w;
    } else {
      abstain += 1;
      weightedAbstain += w;
    }
  }

  const total = ballots.length;
  let quorum: LiveVoteResultPayload["quorum"];
  let quorumMet = true;

  if (params.quorumContext) {
    const { meetingType, policy, invitations, delegations, livePresentUserIds } =
      params.quorumContext;
    const totalInvited = invitations.length;
    const liveSet = new Set(livePresentUserIds);
    /** In CCOS Live, anyone invited and currently in the room counts as present for quorum. */
    const liveInviteeRows: QuorumInvitationRow[] = invitations
      .filter((i) => liveSet.has(i.userId))
      .map((i) => ({
        userId: i.userId,
        status: InvitationStatus.ACCEPTED,
        attendanceCheckedInAt: i.attendanceCheckedInAt ?? new Date(),
      }));
    const attendedCount = countQuorumAttendance(liveInviteeRows, delegations);
    quorum = calculateQuorum({
      meetingType,
      policy,
      totalInvited,
      attendedCount,
    });
    quorumMet = quorum.met;
  }

  const decidingYes =
    rule === "ROLE_WEIGHTED" ? weightedYes > weightedNo : yes > no;
  const decidingNo =
    rule === "ROLE_WEIGHTED" ? weightedNo > weightedYes : no > yes;
  const tie =
    rule === "ROLE_WEIGHTED"
      ? weightedYes === weightedNo && weightedYes > 0
      : yes === no && yes > 0;

  let outcome: LiveVoteResultPayload["outcome"];
  let explanationKey: LiveVoteResultPayload["explanationKey"];

  if (!quorumMet) {
    outcome = "NO_QUORUM";
    explanationKey = "noQuorum";
  } else if (tie && (rule === "MAJORITY" || rule === "QUORUM_GATED")) {
    outcome = "TIE";
    explanationKey = "tie";
  } else if (rule === "ROLE_WEIGHTED") {
    if (weightedYes > weightedNo) {
      outcome = "PASSED";
      explanationKey = "weightedPassed";
    } else {
      outcome = "FAILED";
      explanationKey = "weightedFailed";
    }
  } else if (decidingYes) {
    outcome = "PASSED";
    explanationKey = "majorityPassed";
  } else {
    outcome = "FAILED";
    explanationKey = "majorityFailed";
  }

  return {
    yes,
    no,
    abstain,
    total,
    totalWeightedBallots,
    weightedYes,
    weightedNo,
    weightedAbstain,
    rule,
    quorum,
    outcome,
    explanationKey,
  };
}

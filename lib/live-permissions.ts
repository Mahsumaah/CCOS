import type { BoardRole, MeetingLiveRole } from "@prisma/client";

export const LIVE_VOTING_ALLOWED_ROLES: MeetingLiveRole[] = [
  "CHAIR",
  "VICE_CHAIR",
  "SECRETARY",
  "DECISION_RECORDER",
  "VOTING_MEMBER",
  "SYSTEM_ADMIN",
];

export function boardRoleToLiveRole(role: BoardRole): MeetingLiveRole {
  switch (role) {
    case "CHAIR":
      return "CHAIR";
    case "VICE_CHAIR_1":
    case "VICE_CHAIR_2":
    case "VICE_CHAIR_3":
    case "VICE_CHAIR_4":
      return "VICE_CHAIR";
    case "SECRETARY_GENERAL":
      return "SECRETARY";
    case "MINUTES_CLERK":
      return "DECISION_RECORDER";
    case "VIEWER":
    case "SUPERVISOR":
      return "OBSERVER";
    default:
      return "VOTING_MEMBER";
  }
}

export type LiveCapability =
  | "canJoinLive"
  | "canSpeak"
  | "canShareScreen"
  | "canRaiseHand"
  | "canModerateMedia"
  | "canOpenVote"
  | "canRecordDecision"
  | "canApproveMinutes"
  | "canViewRecording"
  | "canSignMinutes";

const capabilityByRole: Record<MeetingLiveRole, Record<LiveCapability, boolean>> = {
  CHAIR: {
    canJoinLive: true,
    canSpeak: true,
    canShareScreen: true,
    canRaiseHand: true,
    canModerateMedia: true,
    canOpenVote: true,
    canRecordDecision: true,
    canApproveMinutes: true,
    canViewRecording: true,
    canSignMinutes: true,
  },
  VICE_CHAIR: {
    canJoinLive: true,
    canSpeak: true,
    canShareScreen: true,
    canRaiseHand: true,
    canModerateMedia: true,
    canOpenVote: true,
    canRecordDecision: true,
    canApproveMinutes: false,
    canViewRecording: true,
    canSignMinutes: true,
  },
  SECRETARY: {
    canJoinLive: true,
    canSpeak: true,
    canShareScreen: true,
    canRaiseHand: true,
    canModerateMedia: false,
    canOpenVote: true,
    canRecordDecision: true,
    canApproveMinutes: true,
    canViewRecording: true,
    canSignMinutes: true,
  },
  DECISION_RECORDER: {
    canJoinLive: true,
    canSpeak: true,
    canShareScreen: false,
    canRaiseHand: true,
    canModerateMedia: false,
    canOpenVote: false,
    canRecordDecision: true,
    canApproveMinutes: false,
    canViewRecording: true,
    canSignMinutes: false,
  },
  VOTING_MEMBER: {
    canJoinLive: true,
    canSpeak: true,
    canShareScreen: false,
    canRaiseHand: true,
    canModerateMedia: false,
    canOpenVote: false,
    canRecordDecision: false,
    canApproveMinutes: false,
    canViewRecording: true,
    canSignMinutes: true,
  },
  NON_VOTING_MEMBER: {
    canJoinLive: true,
    canSpeak: true,
    canShareScreen: false,
    canRaiseHand: true,
    canModerateMedia: false,
    canOpenVote: false,
    canRecordDecision: false,
    canApproveMinutes: false,
    canViewRecording: true,
    canSignMinutes: false,
  },
  OBSERVER: {
    canJoinLive: true,
    canSpeak: false,
    canShareScreen: false,
    canRaiseHand: true,
    canModerateMedia: false,
    canOpenVote: false,
    canRecordDecision: false,
    canApproveMinutes: false,
    canViewRecording: true,
    canSignMinutes: false,
  },
  GUEST: {
    canJoinLive: true,
    canSpeak: false,
    canShareScreen: false,
    canRaiseHand: false,
    canModerateMedia: false,
    canOpenVote: false,
    canRecordDecision: false,
    canApproveMinutes: false,
    canViewRecording: false,
    canSignMinutes: false,
  },
  SYSTEM_ADMIN: {
    canJoinLive: true,
    canSpeak: true,
    canShareScreen: true,
    canRaiseHand: true,
    canModerateMedia: true,
    canOpenVote: true,
    canRecordDecision: true,
    canApproveMinutes: true,
    canViewRecording: true,
    canSignMinutes: true,
  },
};

export function hasLiveCapability(role: MeetingLiveRole, capability: LiveCapability): boolean {
  return capabilityByRole[role][capability];
}

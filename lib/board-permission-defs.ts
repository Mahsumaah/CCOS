import type { BoardRole } from "@prisma/client";

export type BoardUserPermissionFlags = {
  permCreateMeetings: boolean;
  permEditMeetings: boolean;
  permManageMeetings: boolean;
  permCreateVotes: boolean;
  permCastVotes: boolean;
  permCreateDecisions: boolean;
  permEditDecisions: boolean;
  permFinalizeMinutes: boolean;
  permManagePositions: boolean;
  permManageUsers: boolean;
};

const NONE: BoardUserPermissionFlags = {
  permCreateMeetings: false,
  permEditMeetings: false,
  permManageMeetings: false,
  permCreateVotes: false,
  permCastVotes: false,
  permCreateDecisions: false,
  permEditDecisions: false,
  permFinalizeMinutes: false,
  permManagePositions: false,
  permManageUsers: false,
};

const ALL: BoardUserPermissionFlags = {
  permCreateMeetings: true,
  permEditMeetings: true,
  permManageMeetings: true,
  permCreateVotes: true,
  permCastVotes: true,
  permCreateDecisions: true,
  permEditDecisions: true,
  permFinalizeMinutes: true,
  permManagePositions: true,
  permManageUsers: true,
};

/** Default fine-grained permissions when assigning a board role (invite + reset). */
export function getDefaultPermissions(role: BoardRole): BoardUserPermissionFlags {
  switch (role) {
    case "CHAIR":
    case "SECRETARY_GENERAL":
      return { ...ALL };

    case "VICE_CHAIR_1":
    case "VICE_CHAIR_2":
    case "VICE_CHAIR_3":
    case "VICE_CHAIR_4":
      return { ...ALL, permManageUsers: false };

    case "ASSISTANT_SECRETARY_GENERAL":
      return {
        ...NONE,
        permCreateMeetings: true,
        permEditMeetings: true,
        permCreateVotes: true,
        permCastVotes: true,
        permCreateDecisions: true,
        permFinalizeMinutes: true,
      };

    case "MINUTES_CLERK":
      return {
        ...NONE,
        permEditMeetings: true,
        permFinalizeMinutes: true,
        permCastVotes: true,
      };

    case "MEMBER":
    case "TREASURER":
    case "SUPERVISOR":
      return {
        ...NONE,
        permCastVotes: true,
      };

    case "VIEWER":
      return { ...NONE };

    default:
      return { ...NONE };
  }
}

import type { BoardRole } from "@prisma/client";

/** Board user row for the admin Users table (API + RSC props). */
export type AdminBoardUserJson = {
  id: string;
  name: string;
  email: string;
  role: BoardRole;
  avatar: string | null;
  positionCode: string | null;
  positionLabelAr: string | null;
  positionLabelEn: string | null;
  isActive: boolean;
  updatedAt: string;
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
  /** User has set a password (can sign in with credentials). */
  hasPassword: boolean;
};

export const adminBoardUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  positionCode: true,
  isActive: true,
  updatedAt: true,
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
  position: {
    select: { labelAr: true, labelEn: true },
  },
  password: true,
} as const;

type Row = {
  id: string;
  name: string;
  email: string;
  role: BoardRole;
  avatar: string | null;
  positionCode: string | null;
  isActive: boolean;
  updatedAt: Date;
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
  position: { labelAr: string; labelEn: string | null } | null;
  password: string | null;
};

export function toAdminBoardUserJson(row: Row): AdminBoardUserJson {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatar: row.avatar,
    positionCode: row.positionCode,
    positionLabelAr: row.position?.labelAr ?? null,
    positionLabelEn: row.position?.labelEn ?? null,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
    permCreateMeetings: row.permCreateMeetings,
    permEditMeetings: row.permEditMeetings,
    permManageMeetings: row.permManageMeetings,
    permCreateVotes: row.permCreateVotes,
    permCastVotes: row.permCastVotes,
    permCreateDecisions: row.permCreateDecisions,
    permEditDecisions: row.permEditDecisions,
    permFinalizeMinutes: row.permFinalizeMinutes,
    permManagePositions: row.permManagePositions,
    permManageUsers: row.permManageUsers,
    hasPassword: row.password != null,
  };
}

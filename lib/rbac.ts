import type { Session } from "next-auth";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export { canManageTenantSettings } from "./tenant-settings-permission";

export type PermissionKey =
  | "permCreateMeetings"
  | "permEditMeetings"
  | "permManageMeetings"
  | "permCreateVotes"
  | "permCastVotes"
  | "permCreateDecisions"
  | "permEditDecisions"
  | "permFinalizeMinutes"
  | "permManagePositions"
  | "permManageUsers";

export type EffectivePermissions = {
  canCreateMeetings: boolean;
  canEditMeetings: boolean;
  canManageMeetings: boolean;
  canCreateVotes: boolean;
  canCastVotes: boolean;
  canCreateDecisions: boolean;
  canEditDecisions: boolean;
  canFinalizeMinutes: boolean;
  canManagePositions: boolean;
  canManageUsers: boolean;
  canManageQuorumPolicies: boolean;
};

export type PermissibleUser = {
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

export function getEffectivePermissions(user: PermissibleUser): EffectivePermissions {
  return {
    canCreateMeetings: user.permCreateMeetings,
    canEditMeetings: user.permEditMeetings,
    canManageMeetings: user.permManageMeetings,
    canCreateVotes: user.permCreateVotes,
    canCastVotes: user.permCastVotes,
    canCreateDecisions: user.permCreateDecisions,
    canEditDecisions: user.permEditDecisions,
    canFinalizeMinutes: user.permFinalizeMinutes,
    canManagePositions: user.permManagePositions,
    canManageUsers: user.permManageUsers,
    canManageQuorumPolicies: user.permManagePositions,
  };
}

export type AuthResult =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

export async function requireSession(): Promise<AuthResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

export function requirePermission(
  session: Session,
  permission: PermissionKey,
): NextResponse | null {
  if (!session.user[permission]) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** PATCH meeting metadata, agenda, attachments — `permEditMeetings` or `permManageMeetings`. */
export function requireEditOrManageMeetings(
  session: Session,
): NextResponse | null {
  if (!session.user.permEditMeetings && !session.user.permManageMeetings) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function userMayAccessMeeting(
  userId: string,
  meetingId: string,
  tenantId: string,
  sessionUser: Session["user"],
): Promise<boolean> {
  if (sessionUser.permManageMeetings) {
    const m = await prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
      select: { id: true },
    });
    return Boolean(m);
  }
  const inv = await prisma.meetingInvitation.findFirst({
    where: { meetingId, userId },
    select: { id: true },
  });
  return Boolean(inv);
}

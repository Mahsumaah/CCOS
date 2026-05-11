import { MeetingStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { boardRoleToLiveRole } from "@/lib/live-permissions";
import { prisma } from "@/lib/prisma";
import { userMayAccessMeeting } from "@/lib/rbac";

export async function ensureMeetingLiveAccess(params: {
  meetingId: string;
  tenantId: string;
  userId: string;
  sessionUser: {
    role: import("@prisma/client").BoardRole;
    permManageMeetings: boolean;
  };
}) {
  const meeting = await prisma.meeting.findFirst({
    where: { id: params.meetingId, tenantId: params.tenantId },
    select: { id: true, status: true, title: true },
  });
  if (!meeting) {
    return { ok: false as const, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  const allowed = await userMayAccessMeeting(
    params.userId,
    params.meetingId,
    params.tenantId,
    params.sessionUser as never,
  );
  if (!allowed) {
    return { ok: false as const, response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  return { ok: true as const, meeting };
}

export function buildLiveRoomName(tenantId: string, meetingId: string): string {
  return `ccos-${tenantId}-${meetingId}`;
}

export function canStartLive(status: MeetingStatus): boolean {
  return status === "SCHEDULED" || status === "LIVE";
}

export function canEndLive(status: MeetingStatus): boolean {
  return status === "LIVE";
}

export function currentLiveRoleForUser(role: import("@prisma/client").BoardRole) {
  return boardRoleToLiveRole(role);
}

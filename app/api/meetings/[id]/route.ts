import { MeetingType } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  requireEditOrManageMeetings,
  requirePermission,
  requireSession,
} from "@/lib/rbac";
import { meetingDetailInclude } from "@/lib/meeting-detail-include";
import { createBulkNotifications, getMeetingInviteeUserIds } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import type { EditMeetingMetadataInput } from "@/lib/validations/edit-meeting";
import {
  invalidStatusTransitionMessage,
  isAllowedStatusTransition,
  patchMeetingBodySchema,
} from "@/lib/validations/meeting-apis";

type RouteContext = { params: Promise<{ id: string }> };

async function meetingForTenant(meetingId: string, tenantId: string) {
  return prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true, status: true },
  });
}

function normalizeMetadata(data: EditMeetingMetadataInput) {
  const custom =
    data.type === MeetingType.STRATEGIC || data.type === MeetingType.EMERGENCY
      ? data.customMeetingType?.trim() || null
      : null;

  return {
    title: data.title.trim(),
    type: data.type,
    customMeetingType: custom,
    objectives: data.objectives?.trim() || null,
    scheduledAt: data.scheduledAt,
    durationMin: data.durationMin,
    location: data.location?.trim() || null,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id } = await context.params;
  const tenantId = session.user.tenantId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchMeetingBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  if ("status" in payload) {
    const denied = requirePermission(session, "permManageMeetings");
    if (denied) return denied;

    const nextStatus = payload.status;
    const existing = await meetingForTenant(id, tenantId);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!isAllowedStatusTransition(existing.status, nextStatus)) {
      return NextResponse.json(
        { error: invalidStatusTransitionMessage(existing.status, nextStatus) },
        { status: 400 },
      );
    }

    const now = new Date();

    const data: {
      status: typeof nextStatus;
      startedAt?: Date;
      endedAt?: Date;
    } = { status: nextStatus };

    if (nextStatus === "LIVE") {
      data.startedAt = now;
    }

    if (nextStatus === "ENDED") {
      data.endedAt = now;
    }

    try {
      const meeting = await prisma.meeting.update({
        where: { id, tenantId },
        data,
        include: meetingDetailInclude,
      });

      const inviteeIds = await getMeetingInviteeUserIds(id);
      if (inviteeIds.length) {
        if (nextStatus === "LIVE") {
          await createBulkNotifications({
            userIds: inviteeIds,
            meetingId: id,
            type: "MEETING_STARTED",
            payload: { meetingTitle: meeting.title },
          });
        } else if (nextStatus === "ENDED") {
          await createBulkNotifications({
            userIds: inviteeIds,
            meetingId: id,
            type: "MEETING_ENDED",
            payload: { meetingTitle: meeting.title },
          });
        }
      }

      return NextResponse.json(meeting);
    } catch (e) {
      console.error(e);
      return NextResponse.json(
        { error: "Could not update meeting" },
        { status: 500 },
      );
    }
  }

  const metaDenied = requireEditOrManageMeetings(session);
  if (metaDenied) return metaDenied;

  const existing = await meetingForTenant(id, tenantId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.status !== "SCHEDULED") {
    return NextResponse.json(
      {
        error:
          "Meeting details can only be edited while the meeting is scheduled.",
      },
      { status: 400 },
    );
  }

  const normalized = normalizeMetadata(payload);

  try {
    const meeting = await prisma.meeting.update({
      where: { id, tenantId },
      data: normalized,
      include: meetingDetailInclude,
    });

    return NextResponse.json(meeting);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not update meeting" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManageMeetings");
  if (denied) return denied;

  const { id } = await context.params;
  const tenantId = session.user.tenantId;

  const existing = await meetingForTenant(id, tenantId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.meeting.delete({
      where: { id, tenantId },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not delete meeting" },
      { status: 500 },
    );
  }
}

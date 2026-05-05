import type { BoardRole, Prisma } from "@prisma/client";
import { MeetingSchedulingMode } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  requirePermission,
  requireSession,
} from "@/lib/rbac";
import { createBulkNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { checkPlanLimit, planLimitForbiddenResponse } from "@/lib/plan-limits";
import { meetingCreateJsonSchema } from "@/lib/validations/create-meeting";

const meetingInclude = {
  createdBy: true,
  minutes: { select: { id: true } },
  _count: {
    select: {
      agenda: true,
      invitations: true,
      votes: true,
      decisions: true,
    },
  },
} satisfies Prisma.MeetingInclude;

export async function GET(request: Request) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") === "past" ? "past" : "upcoming";
  const q = (searchParams.get("q") ?? "").trim();

  const tenantId = session.user.tenantId;
  const now = new Date();

  const searchFilter: Prisma.MeetingWhereInput | undefined = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
          { customMeetingType: { contains: q, mode: "insensitive" } },
        ],
      }
    : undefined;

  const where: Prisma.MeetingWhereInput = {
    tenantId,
    ...(tab === "upcoming"
      ? {
          OR: [
            { status: "LIVE" },
            { status: "SCHEDULED", scheduledAt: { gte: now } },
          ],
        }
      : {
          status: { in: ["ENDED", "ARCHIVED", "CANCELLED"] },
        }),
    ...(searchFilter ? searchFilter : {}),
  };

  const meetings = await prisma.meeting.findMany({
    where,
    include: meetingInclude,
    orderBy:
      tab === "upcoming"
        ? { scheduledAt: "asc" }
        : { endedAt: { sort: "desc", nulls: "last" } },
  });

  return NextResponse.json(meetings);
}

export async function POST(request: Request) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permCreateMeetings");
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = meetingCreateJsonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const tenantId = session.user.tenantId;
  const creatorId = session.user.id;

  const inviteeUsers = await prisma.boardUser.findMany({
    where: {
      id: { in: data.inviteeIds },
      tenantId,
      isActive: true,
    },
    select: { id: true, role: true, email: true },
  });

  const invitationMap = new Map<string, BoardRole>();
  for (const u of inviteeUsers) {
    invitationMap.set(u.id, u.role);
  }

  for (const email of data.guestEmails) {
    const guest = await prisma.boardUser.findFirst({
      where: {
        tenantId,
        email: { equals: email, mode: "insensitive" },
        isActive: true,
      },
      select: { id: true, role: true },
    });
    if (guest && !invitationMap.has(guest.id)) {
      invitationMap.set(guest.id, guest.role);
    }
  }

  const isInstant = data.schedulingMode === MeetingSchedulingMode.INSTANT;
  const now = new Date();

  const invitationRows = [...invitationMap.entries()].map(
    ([userId, role]) => ({
      userId,
      role,
    }),
  );

  const meetingLimit = await checkPlanLimit(tenantId, "CREATE_MEETING");
  if (!meetingLimit.allowed) {
    return planLimitForbiddenResponse(meetingLimit);
  }

  try {
    const meeting = await prisma.meeting.create({
      data: {
        tenantId,
        title: data.title.trim(),
        type: data.type,
        customMeetingType: data.customMeetingType?.trim() || null,
        objectives: data.objectives?.trim() || null,
        schedulingMode: data.schedulingMode,
        scheduledAt: data.scheduledAt,
        durationMin: data.durationMin,
        location: data.location?.trim() || null,
        createdById: creatorId,
        status: isInstant ? "LIVE" : "SCHEDULED",
        startedAt: isInstant ? now : null,
        agenda: {
          create: data.agenda.map((item, order) => ({
            order,
            titleAr: item.titleAr.trim(),
            titleEn: item.titleEn?.trim() || null,
            notes: item.notes?.trim() || null,
          })),
        },
        ...(invitationRows.length > 0
          ? {
              invitations: {
                createMany: {
                  data: invitationRows.map((row) => ({
                    userId: row.userId,
                    role: row.role,
                  })),
                },
              },
            }
          : {}),
      },
      include: {
        agenda: true,
        invitations: true,
        createdBy: true,
      },
    });

    if (isInstant && meeting.invitations?.length) {
      const userIds = meeting.invitations.map((inv) => inv.userId);
      await createBulkNotifications({
        userIds,
        meetingId: meeting.id,
        type: "MEETING_INVITE",
        payload: { meetingTitle: meeting.title },
      });

      const invRows = await prisma.meetingInvitation.findMany({
        where: { meetingId: meeting.id },
        include: { user: { select: { email: true, name: true } } },
      });
      for (const row of invRows) {
        const to = row.user.email?.trim();
        if (!to) continue;
        console.log("Email skipped:", {
          to,
          subject: `Meeting invitation: ${meeting.title}`,
        });
      }
    }

    return NextResponse.json(meeting, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not create meeting" },
      { status: 500 },
    );
  }
}

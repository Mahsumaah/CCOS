import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function getMeetingInviteeUserIds(
  meetingId: string,
): Promise<string[]> {
  const rows = await prisma.meetingInvitation.findMany({
    where: { meetingId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

export async function createNotification(params: {
  userId: string;
  meetingId?: string | null;
  type: string;
  payload?: Prisma.InputJsonValue;
}) {
  return prisma.boardNotification.create({
    data: {
      userId: params.userId,
      meetingId: params.meetingId ?? undefined,
      type: params.type,
      payload: params.payload ?? undefined,
    },
  });
}

export async function createBulkNotifications(params: {
  userIds: string[];
  meetingId?: string | null;
  type: string;
  payload?: Prisma.InputJsonValue;
}) {
  const ids = [...new Set(params.userIds)].filter(Boolean);
  if (ids.length === 0) {
    return { count: 0 };
  }
  const result = await prisma.boardNotification.createMany({
    data: ids.map((userId) => ({
      userId,
      meetingId: params.meetingId ?? null,
      type: params.type,
      payload: params.payload ?? undefined,
    })),
  });
  return { count: result.count };
}

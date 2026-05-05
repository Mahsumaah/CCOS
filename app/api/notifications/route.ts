import { NextResponse } from "next/server";

import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const rows = await prisma.boardNotification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      meeting: { select: { id: true, title: true } },
    },
  });

  const notifications = rows.map((n) => ({
    id: n.id,
    type: n.type,
    payload: n.payload,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
    meetingId: n.meetingId,
    meeting: n.meeting
      ? { id: n.meeting.id, title: n.meeting.title }
      : null,
  }));

  return NextResponse.json({ notifications });
}

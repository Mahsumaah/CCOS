import { NextResponse } from "next/server";

import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id } = await context.params;
  const existing = await prisma.boardNotification.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.boardNotification.update({
    where: { id },
    data: { readAt: new Date() },
    include: {
      meeting: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({
    id: updated.id,
    type: updated.type,
    payload: updated.payload,
    readAt: updated.readAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    meetingId: updated.meetingId,
    meeting: updated.meeting
      ? { id: updated.meeting.id, title: updated.meeting.title }
      : null,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id } = await context.params;
  const existing = await prisma.boardNotification.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.boardNotification.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";

import { requireEditOrManageMeetings, requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { meetingDetailInclude } from "@/lib/meeting-detail-include";

type RouteContext = { params: Promise<{ attId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requireEditOrManageMeetings(session);
  if (denied) return denied;

  const { attId } = await context.params;
  const tenantId = session.user.tenantId;

  const att = await prisma.meetingAttachment.findFirst({
    where: {
      id: attId,
      meeting: { tenantId },
    },
    select: { id: true, meetingId: true },
  });

  if (!att) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.meetingAttachment.delete({
      where: { id: attId },
    });

    const full = await prisma.meeting.findFirst({
      where: { id: att.meetingId, tenantId },
      include: meetingDetailInclude,
    });

    return NextResponse.json(full);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not delete attachment" },
      { status: 500 },
    );
  }
}

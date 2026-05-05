import { NextResponse } from "next/server";

import { requireEditOrManageMeetings, requireSession } from "@/lib/rbac";
import { meetingDetailInclude } from "@/lib/meeting-detail-include";
import { prisma } from "@/lib/prisma";
import { postMeetingAttachmentBodySchema } from "@/lib/validations/meeting-apis";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requireEditOrManageMeetings(session);
  if (denied) return denied;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postMeetingAttachmentBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { url, name, mime, size } = parsed.data;

  try {
    await prisma.meetingAttachment.create({
      data: {
        meetingId,
        agendaItemId: null,
        url,
        name,
        mime: mime ?? null,
        size: size ?? null,
        uploadedById: session.user.id,
      },
    });

    const full = await prisma.meeting.findFirst({
      where: { id: meetingId, tenantId },
      include: meetingDetailInclude,
    });

    return NextResponse.json(full, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save attachment" },
      { status: 500 },
    );
  }
}

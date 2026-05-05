import { NextResponse } from "next/server";

import { requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { rsvpInvitationBodySchema } from "@/lib/validations/meeting-apis";

type RouteContext = { params: Promise<{ invId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { invId } = await context.params;
  const tenantId = session.user.tenantId;

  const invitation = await prisma.meetingInvitation.findFirst({
    where: {
      id: invId,
      meeting: { tenantId },
    },
    select: { id: true, userId: true },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (invitation.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = rsvpInvitationBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const now = new Date();

  try {
    const updated = await prisma.meetingInvitation.update({
      where: { id: invId },
      data: {
        status: parsed.data.status,
        respondedAt: now,
      },
      include: { user: true },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not update invitation" },
      { status: 500 },
    );
  }
}

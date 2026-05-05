import { NextResponse } from "next/server";

import { requirePermission, requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { postMinutesAdoptBodySchema } from "@/lib/validations/minutes-adopt";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permFinalizeMinutes");
  if (denied) return denied;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postMinutesAdoptBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const minutes = await prisma.minutes.findUnique({
    where: { meetingId },
    select: { id: true, finalizedAt: true },
  });
  if (!minutes) {
    return NextResponse.json({ error: "Minutes not generated" }, { status: 404 });
  }
  if (!minutes.finalizedAt) {
    return NextResponse.json(
      { error: "Minutes must be finalized before adopting a document." },
      { status: 400 },
    );
  }

  const { url, name, mime, size } = parsed.data;
  const now = new Date();

  try {
    await prisma.minutes.update({
      where: { meetingId },
      data: {
        adoptedDocumentUrl: url,
        adoptedDocumentName: name,
        adoptedDocumentMime: mime,
        adoptedDocumentSize: size,
        adoptedById: session.user.id,
        adoptedAt: now,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save adopted document" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

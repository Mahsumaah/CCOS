import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { requireSession } from "@/lib/rbac";
import { createNotification } from "@/lib/notifications";
import { checkPlanLimit, planLimitForbiddenResponse } from "@/lib/plan-limits";
import { prisma } from "@/lib/prisma";
import { postMinutesSignBodySchema } from "@/lib/validations/minutes-api";

type RouteContext = { params: Promise<{ id: string }> };

function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

export async function POST(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postMinutesSignBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true, title: true, createdById: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const signLimit = await checkPlanLimit(tenantId, "SIGN");
  if (!signLimit.allowed) {
    return planLimitForbiddenResponse(signLimit);
  }

  const invitee = await prisma.meetingInvitation.findFirst({
    where: { meetingId, userId: session.user.id },
    select: { id: true },
  });
  if (!invitee) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const minutes = await prisma.minutes.findUnique({
    where: { meetingId },
    select: { id: true, finalizedAt: true, contentHtml: true },
  });
  if (!minutes) {
    return NextResponse.json({ error: "Minutes not generated" }, { status: 404 });
  }
  if (!minutes.finalizedAt) {
    return NextResponse.json(
      { error: "Minutes must be finalized before signing." },
      { status: 400 },
    );
  }

  const typedName =
    parsed.data.typedName === null
      ? null
      : parsed.data.typedName.trim() || null;
  const signatureImageUrl =
    parsed.data.signatureImageUrl === null
      ? null
      : parsed.data.signatureImageUrl.trim() || null;

  const hash = createHash("md5")
    .update(minutes.contentHtml, "utf8")
    .digest("hex");
  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent");

  try {
    await prisma.minutesSignature.upsert({
      where: {
        minutesId_userId: {
          minutesId: minutes.id,
          userId: session.user.id,
        },
      },
      create: {
        minutesId: minutes.id,
        userId: session.user.id,
        typedName,
        signatureImageUrl,
        signedAt: new Date(),
        ip,
        userAgent,
        hash,
      },
      update: {
        typedName,
        signatureImageUrl,
        signedAt: new Date(),
        ip,
        userAgent,
        hash,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save signature" },
      { status: 500 },
    );
  }

  if (
    meeting.createdById &&
    meeting.createdById !== session.user.id
  ) {
    await createNotification({
      userId: meeting.createdById,
      meetingId,
      type: "MINUTES_SIGNED",
      payload: {
        meetingTitle: meeting.title,
        signerName: session.user.name ?? session.user.email ?? "—",
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const minutes = await prisma.minutes.findUnique({
    where: { meetingId },
    select: { id: true },
  });
  if (!minutes) {
    return NextResponse.json({ error: "Minutes not generated" }, { status: 404 });
  }

  try {
    await prisma.minutesSignature.deleteMany({
      where: {
        minutesId: minutes.id,
        userId: session.user.id,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not remove signature" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

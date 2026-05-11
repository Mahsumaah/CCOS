import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

const segmentSchema = z.object({
  text: z.string().min(1).max(8000),
  speakerName: z.string().max(200).nullable().optional(),
  speakerUserId: z.string().cuid().nullable().optional(),
  language: z.string().max(16).nullable().optional(),
  startedAtMs: z.number().int().nonnegative().nullable().optional(),
  endedAtMs: z.number().int().nonnegative().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const bodySchema = z.object({
  liveSessionId: z.string().cuid().nullable().optional(),
  segments: z.array(segmentSchema).min(1).max(500),
});

export async function POST(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  if (!session.user.permFinalizeMinutes && !session.user.permManageMeetings) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: meetingId } = await context.params;
  const access = await ensureMeetingLiveAccess({
    meetingId,
    tenantId: session.user.tenantId,
    userId: session.user.id,
    sessionUser: {
      role: session.user.role,
      permManageMeetings: session.user.permManageMeetings,
    },
  });
  if (!access.ok) return access.response;

  const json = (await request.json().catch(() => ({}))) as unknown;
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { segments, liveSessionId } = parsed.data;

  if (liveSessionId) {
    const ls = await prisma.liveSession.findFirst({
      where: {
        id: liveSessionId,
        meetingId,
        tenantId: session.user.tenantId,
      },
      select: { id: true },
    });
    if (!ls) {
      return NextResponse.json({ error: "Invalid live session" }, { status: 400 });
    }
  }

  const created = await prisma.$transaction(
    segments.map((s) =>
      prisma.transcriptSegment.create({
        data: {
          tenantId: session.user.tenantId,
          meetingId,
          liveSessionId: liveSessionId ?? null,
          text: s.text,
          speakerName: s.speakerName ?? null,
          speakerUserId: s.speakerUserId ?? null,
          language: s.language ?? null,
          startedAtMs: s.startedAtMs ?? null,
          endedAtMs: s.endedAtMs ?? null,
          confidence: s.confidence ?? null,
        },
      }),
    ),
  );

  return NextResponse.json({ ok: true, count: created.length }, { status: 201 });
}

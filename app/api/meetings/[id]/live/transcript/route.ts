import { LiveSessionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit-log";
import { ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
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

  const url = new URL(request.url);
  const liveSessionId = url.searchParams.get("liveSessionId");
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

  const segments = await prisma.transcriptSegment.findMany({
    where: {
      meetingId,
      tenantId: session.user.tenantId,
      ...(liveSessionId ? { liveSessionId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 2000,
    select: {
      id: true,
      text: true,
      speakerName: true,
      language: true,
      createdAt: true,
      liveSessionId: true,
    },
  });

  return NextResponse.json({ segments, count: segments.length });
}

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
      select: { id: true, status: true },
    });
    if (!ls) {
      return NextResponse.json({ error: "Invalid live session" }, { status: 400 });
    }
    if (ls.status !== LiveSessionStatus.LIVE) {
      return NextResponse.json({ error: "live_session_not_active" }, { status: 400 });
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

  await writeAuditLog({
    tenantId: session.user.tenantId,
    meetingId,
    liveSessionId: liveSessionId ?? null,
    actorId: session.user.id,
    action: "TRANSCRIPT_SEGMENTS_INGESTED",
    targetType: "TranscriptSegment",
    targetId: created[0]?.id ?? null,
    payloadJson: { count: created.length },
  });

  return NextResponse.json({ ok: true, count: created.length }, { status: 201 });
}

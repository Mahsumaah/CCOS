import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildTranscriptDraftMessages,
  segmentsToPlainText,
  TRANSCRIPT_DRAFT_CHAR_BUDGET,
  truncateTranscriptForModel,
} from "@/lib/ai-live-transcript-draft";
import {
  consumeRateLimit,
  draftMinutesRateLimitKey,
} from "@/lib/ai-draft-rate-limit";
import { writeAuditLog } from "@/lib/audit-log";
import { ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { isOpenRouterConfigured, openRouterChatCompletion } from "@/lib/openrouter";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

function parseLocale(request: Request): "ar" | "en" {
  const url = new URL(request.url);
  const q = url.searchParams.get("locale");
  return q === "en" ? "en" : "ar";
}

const postBody = z.object({
  liveSessionId: z.string().cuid().nullable().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;
  const locale = parseLocale(request);

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

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { error: "openrouter_not_configured" },
      { status: 503 },
    );
  }

  const json = (await request.json().catch(() => ({}))) as unknown;
  const parsed = postBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const liveSessionId = parsed.data.liveSessionId ?? undefined;

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

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId: session.user.tenantId },
    select: { title: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
      text: true,
      speakerName: true,
      createdAt: true,
      liveSessionId: true,
    },
  });

  if (segments.length === 0) {
    return NextResponse.json({ error: "no_transcript_segments" }, { status: 400 });
  }

  const fullText = segmentsToPlainText(segments);
  const { text: transcriptSlice, truncated } = truncateTranscriptForModel(
    fullText,
    TRANSCRIPT_DRAFT_CHAR_BUDGET,
  );

  const messages = buildTranscriptDraftMessages({
    meetingTitle: meeting.title,
    locale,
    transcriptText: transcriptSlice,
  });

  const limitKey = draftMinutesRateLimitKey(session.user.tenantId, session.user.id);
  if (!consumeRateLimit(limitKey, 8, 10 * 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const { content, model } = await openRouterChatCompletion({
      messages,
      maxTokens: 2048,
      temperature: 0.25,
    });

    const auditLiveSessionId =
      liveSessionId ?? segments.find((s) => s.liveSessionId)?.liveSessionId ?? null;

    await writeAuditLog({
      tenantId: session.user.tenantId,
      meetingId,
      liveSessionId: auditLiveSessionId,
      actorId: session.user.id,
      action: "LIVE_AI_DRAFT_GENERATED",
      targetType: "LiveAiDraft",
      targetId: meetingId,
      payloadJson: { model, segmentCount: segments.length, truncated },
    });

    return NextResponse.json({
      markdown: content,
      model,
      segmentCount: segments.length,
      truncated,
    });
  } catch (e) {
    console.error("[live/ai/draft-minutes]", e);
    return NextResponse.json(
      { error: "openrouter_failed", message: e instanceof Error ? e.message : "unknown" },
      { status: 502 },
    );
  }
}

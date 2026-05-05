import { NextResponse } from "next/server";

import {
  requirePermission,
  requireSession,
  userMayAccessMeeting,
} from "@/lib/rbac";
import { buildMinutesData } from "@/lib/minutes/build";
import { generateMinutesHtml } from "@/lib/minutes/generate-html";
import { prisma } from "@/lib/prisma";
import { getRoleLabel } from "@/lib/board-roles";
import { patchMinutesBodySchema } from "@/lib/validations/minutes-api";

type RouteContext = { params: Promise<{ id: string }> };

type Locale = "ar" | "en";

function parseLocale(request: Request): Locale {
  const u = new URL(request.url);
  return u.searchParams.get("locale") === "en" ? "en" : "ar";
}

async function serializeMinutesForMeeting(
  meetingId: string,
  locale: Locale,
) {
  const row = await prisma.minutes.findUnique({
    where: { meetingId },
    include: {
      signatures: {
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
        orderBy: { signedAt: "asc" },
      },
    },
  });
  if (!row) return null;

  const extraIds = [row.finalizedById, row.adoptedById].filter(
    (x): x is string => Boolean(x),
  );
  const extras =
    extraIds.length > 0
      ? await prisma.boardUser.findMany({
          where: { id: { in: extraIds } },
          select: { id: true, name: true },
        })
      : [];
  const nameBy = Object.fromEntries(extras.map((u) => [u.id, u.name]));

  return {
    id: row.id,
    meetingId: row.meetingId,
    contentHtml: row.contentHtml,
    generatedAt: row.generatedAt,
    finalizedAt: row.finalizedAt,
    finalizedById: row.finalizedById,
    finalizedByName: row.finalizedById
      ? (nameBy[row.finalizedById] ?? null)
      : null,
    adoptedDocumentUrl: row.adoptedDocumentUrl,
    adoptedDocumentName: row.adoptedDocumentName,
    adoptedDocumentMime: row.adoptedDocumentMime,
    adoptedDocumentSize: row.adoptedDocumentSize,
    adoptedAt: row.adoptedAt,
    adoptedById: row.adoptedById,
    adoptedByName: row.adoptedById ? (nameBy[row.adoptedById] ?? null) : null,
    attendeesNotifiedAt: row.attendeesNotifiedAt,
    signatures: row.signatures.map((s) => ({
      id: s.id,
      userId: s.userId,
      userName: s.user.name,
      role: s.user.role,
      roleLabel: getRoleLabel(s.user.role, locale),
      signedAt: s.signedAt,
      typedName: s.typedName,
      signatureImageUrl: s.signatureImageUrl,
    })),
  };
}

export async function GET(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;
  const locale = parseLocale(request);

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await userMayAccessMeeting(
    session.user.id,
    meetingId,
    tenantId,
    session.user,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const minutes = await serializeMinutesForMeeting(meetingId, locale);
  if (!minutes) {
    return NextResponse.json({ error: "Minutes not generated" }, { status: 404 });
  }

  return NextResponse.json({ minutes });
}

export async function POST(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permFinalizeMinutes");
  if (denied) return denied;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;
  const locale = parseLocale(request);

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true, status: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (meeting.status !== "ENDED" && meeting.status !== "ARCHIVED") {
    return NextResponse.json(
      { error: "Minutes can only be generated after the meeting has ended." },
      { status: 400 },
    );
  }

  const existing = await prisma.minutes.findUnique({
    where: { meetingId },
    select: { id: true, finalizedAt: true },
  });
  if (existing?.finalizedAt) {
    return NextResponse.json(
      { error: "Finalized minutes cannot be regenerated." },
      { status: 400 },
    );
  }

  let data;
  try {
    data = await buildMinutesData(meetingId, tenantId, locale);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not build minutes data" },
      { status: 500 },
    );
  }

  const contentHtml = generateMinutesHtml(data, locale);

  try {
    const contentJson = JSON.parse(JSON.stringify(data)) as object;

    await prisma.minutes.upsert({
      where: { meetingId },
      create: {
        meetingId,
        contentHtml,
        contentJson,
        generatedAt: new Date(),
      },
      update: {
        contentHtml,
        contentJson,
        generatedAt: new Date(),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save minutes" },
      { status: 500 },
    );
  }

  const minutes = await serializeMinutesForMeeting(meetingId, locale);
  return NextResponse.json({ minutes });
}

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permFinalizeMinutes");
  if (denied) return denied;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;
  const locale = parseLocale(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchMinutesBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  const meeting = await prisma.meeting.findFirst({
    where: { id: meetingId, tenantId },
    select: { id: true },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = await prisma.minutes.findUnique({
    where: { meetingId },
    select: {
      id: true,
      finalizedAt: true,
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Minutes not generated" }, { status: 404 });
  }

  const isFinalized = row.finalizedAt != null;

  if (payload.contentHtml !== undefined && isFinalized) {
    return NextResponse.json(
      { error: "Minutes are finalized and cannot be edited." },
      { status: 400 },
    );
  }

  if (payload.finalize === true) {
    if (isFinalized) {
      return NextResponse.json(
        { error: "Minutes are already finalized." },
        { status: 400 },
      );
    }
  }

  const now = new Date();
  const data: {
    contentHtml?: string;
    finalizedAt?: Date | null;
    finalizedById?: string | null;
  } = {};

  if (payload.contentHtml !== undefined) {
    data.contentHtml = payload.contentHtml;
  }

  if (payload.finalize === true) {
    data.finalizedAt = now;
    data.finalizedById = session.user.id;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  try {
    await prisma.minutes.update({
      where: { meetingId },
      data,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not update minutes" },
      { status: 500 },
    );
  }

  const minutes = await serializeMinutesForMeeting(meetingId, locale);
  return NextResponse.json({ minutes });
}

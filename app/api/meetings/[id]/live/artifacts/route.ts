import { ArtifactType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit-log";
import { ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  type: z.nativeEnum(ArtifactType),
  url: z.string().url(),
  name: z.string().min(1).max(255),
  mime: z.string().max(200).nullable().optional(),
  size: z.number().int().nonnegative().nullable().optional(),
  source: z.string().max(120).nullable().optional(),
});

export async function GET(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

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

  const artifacts = await prisma.meetingArtifact.findMany({
    where: { meetingId, tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ artifacts });
}

export async function POST(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

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
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const artifact = await prisma.meetingArtifact.create({
    data: {
      tenantId: session.user.tenantId,
      meetingId,
      type: parsed.data.type,
      url: parsed.data.url,
      name: parsed.data.name,
      mime: parsed.data.mime ?? null,
      size: parsed.data.size ?? null,
      source: parsed.data.source ?? "manual",
      createdById: session.user.id,
    },
  });

  await writeAuditLog({
    tenantId: session.user.tenantId,
    meetingId,
    actorId: session.user.id,
    action: "ARTIFACT_CREATED",
    targetType: "MeetingArtifact",
    targetId: artifact.id,
    payloadJson: { type: artifact.type, name: artifact.name },
  });

  return NextResponse.json(artifact, { status: 201 });
}

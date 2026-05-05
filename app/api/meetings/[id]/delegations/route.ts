import { NextResponse } from "next/server";

import { requireSession, userMayAccessMeeting } from "@/lib/rbac";
import { checkPlanLimit, planLimitForbiddenResponse } from "@/lib/plan-limits";
import { prisma } from "@/lib/prisma";
import {
  postDelegationCreateJsonBodySchema,
} from "@/lib/validations/delegation-apis";

type RouteContext = { params: Promise<{ id: string }> };

function wouldCreateCycle(
  edges: { fromUserId: string; toUserId: string }[],
  fromUserId: string,
  toUserId: string,
): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const arr = adj.get(e.fromUserId) ?? [];
    arr.push(e.toUserId);
    adj.set(e.fromUserId, arr);
  }
  const next = adj.get(fromUserId) ?? [];
  next.push(toUserId);
  adj.set(fromUserId, next);

  const stack = [toUserId];
  const seen = new Set<string>();
  while (stack.length) {
    const v = stack.pop()!;
    if (v === fromUserId) return true;
    if (seen.has(v)) continue;
    seen.add(v);
    for (const w of adj.get(v) ?? []) stack.push(w);
  }
  return false;
}

function serializeDelegation(d: {
  id: string;
  meetingId: string;
  fromUserId: string;
  toUserId: string;
  scope: import("@prisma/client").DelegationScope;
  authDocUrl: string | null;
  authDocName: string | null;
  authDocMime: string | null;
  authDocSize: number | null;
  revokedAt: Date | null;
  createdAt: Date;
  fromUser: { id: string; name: string; role: import("@prisma/client").BoardRole };
  toUser: { id: string; name: string; role: import("@prisma/client").BoardRole };
}) {
  return {
    id: d.id,
    meetingId: d.meetingId,
    fromUserId: d.fromUserId,
    toUserId: d.toUserId,
    scope: d.scope,
    authDocUrl: d.authDocUrl,
    authDocName: d.authDocName,
    authDocMime: d.authDocMime,
    authDocSize: d.authDocSize,
    revokedAt: d.revokedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    fromUser: d.fromUser,
    toUser: d.toUser,
  };
}

export async function GET(_request: Request, context: RouteContext) {
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

  const allowed = await userMayAccessMeeting(
    session.user.id,
    meetingId,
    tenantId,
    session.user,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await prisma.meetingDelegation.findMany({
    where: { meetingId },
    orderBy: { createdAt: "desc" },
    include: {
      fromUser: { select: { id: true, name: true, role: true } },
      toUser: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json({
    delegations: rows.map(serializeDelegation),
  });
}

export async function POST(request: Request, context: RouteContext) {
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

  const delegateLimit = await checkPlanLimit(tenantId, "DELEGATE");
  if (!delegateLimit.allowed) {
    return planLimitForbiddenResponse(delegateLimit);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postDelegationCreateJsonBodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { fromUserId, toUserId, scope, authDocUrl, authDocName, authDocMime, authDocSize } =
    parsed.data;

  if (fromUserId === toUserId) {
    return NextResponse.json(
      { error: "From and to users must differ" },
      { status: 400 },
    );
  }

  const canCreate =
    session.user.permManageMeetings || fromUserId === session.user.id;
  if (!canCreate) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [fromInv, toInv] = await Promise.all([
    prisma.meetingInvitation.findFirst({
      where: { meetingId, userId: fromUserId },
      select: { id: true },
    }),
    prisma.meetingInvitation.findFirst({
      where: { meetingId, userId: toUserId },
      select: { id: true },
    }),
  ]);

  if (!fromInv || !toInv) {
    return NextResponse.json(
      { error: "Both users must be invited to this meeting" },
      { status: 400 },
    );
  }

  const existingFrom = await prisma.meetingDelegation.findFirst({
    where: { meetingId, fromUserId, revokedAt: null },
    select: { id: true },
  });

  if (existingFrom) {
    return NextResponse.json(
      { error: "This member already has an active delegation" },
      { status: 400 },
    );
  }

  const activeEdges = await prisma.meetingDelegation.findMany({
    where: { meetingId, revokedAt: null },
    select: { fromUserId: true, toUserId: true },
  });

  if (wouldCreateCycle(activeEdges, fromUserId, toUserId)) {
    return NextResponse.json(
      { error: "This delegation would create a circular chain" },
      { status: 400 },
    );
  }

  const created = await prisma.meetingDelegation.create({
    data: {
      meetingId,
      fromUserId,
      toUserId,
      scope,
      authDocUrl: authDocUrl ?? null,
      authDocName: authDocName ?? null,
      authDocMime: authDocMime ?? null,
      authDocSize: authDocSize ?? null,
    },
    include: {
      fromUser: { select: { id: true, name: true, role: true } },
      toUser: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json(serializeDelegation(created), { status: 201 });
}

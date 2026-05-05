import { NextResponse } from "next/server";

import {
  adminBoardUserSelect,
  toAdminBoardUserJson,
} from "@/lib/admin-board-user";
import { requirePermission, requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { patchUserBodySchema } from "@/lib/validations/users-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManageUsers");
  if (denied) return denied;

  const { id: targetId } = await context.params;
  if (!targetId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const json = (await request.json()) as unknown;
  const parsed = patchUserBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const isSelf = targetId === session.user.id;

  if (isSelf && body.permManageUsers === false) {
    return NextResponse.json(
      { error: "cannotRevokeOwnUserAdmin" },
      { status: 400 },
    );
  }

  if (isSelf && body.isActive === false) {
    return NextResponse.json(
      { error: "cannotDeactivateSelf" },
      { status: 400 },
    );
  }

  let positionCode: string | null | undefined = body.positionCode;
  if (positionCode === "") positionCode = null;
  if (positionCode !== undefined && positionCode !== null) {
    const pos = await prisma.organizationalPosition.findFirst({
      where: { code: positionCode, isActive: true },
    });
    if (!pos) {
      return NextResponse.json(
        { error: "Invalid position" },
        { status: 400 },
      );
    }
  }

  const existing = await prisma.boardUser.findFirst({
    where: { id: targetId, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.role !== undefined) data.role = body.role;
  if (body.positionCode !== undefined) data.positionCode = positionCode;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const permKeys = [
    "permCreateMeetings",
    "permEditMeetings",
    "permManageMeetings",
    "permCreateVotes",
    "permCastVotes",
    "permCreateDecisions",
    "permEditDecisions",
    "permFinalizeMinutes",
    "permManagePositions",
    "permManageUsers",
  ] as const;
  for (const k of permKeys) {
    if (body[k] !== undefined) data[k] = body[k];
  }

  const updated = await prisma.boardUser.update({
    where: { id: targetId },
    data,
    select: adminBoardUserSelect,
  });

  return NextResponse.json(toAdminBoardUserJson(updated));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManageUsers");
  if (denied) return denied;

  const { id: targetId } = await context.params;
  if (!targetId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (targetId === session.user.id) {
    return NextResponse.json(
      { error: "cannotDeactivateSelf" },
      { status: 400 },
    );
  }

  const existing = await prisma.boardUser.findFirst({
    where: { id: targetId, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.boardUser.update({
    where: { id: targetId },
    data: { isActive: false },
    select: adminBoardUserSelect,
  });

  return NextResponse.json(toAdminBoardUserJson(updated));
}

import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import {
  adminBoardUserSelect,
  toAdminBoardUserJson,
  type AdminBoardUserJson,
} from "@/lib/admin-board-user";
import { requirePermission, requireSession } from "@/lib/rbac";
import { getDefaultPermissions } from "@/lib/board-permission-defs";
import { prisma } from "@/lib/prisma";
import { checkPlanLimit, planLimitForbiddenResponse } from "@/lib/plan-limits";
import { postInviteUserBodySchema } from "@/lib/validations/users-api";

function newPasswordSetupToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function GET(request: Request) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const url = new URL(request.url);
  const picker =
    url.searchParams.get("picker") === "1" ||
    url.searchParams.get("forMeeting") === "1";

  if (picker) {
    const users = await prisma.boardUser.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(users);
  }

  const adminDenied = requirePermission(session, "permManageUsers");
  if (!adminDenied) {
    const rows = await prisma.boardUser.findMany({
      where: { tenantId: session.user.tenantId },
      select: adminBoardUserSelect,
      orderBy: { name: "asc" },
    });
    const users: AdminBoardUserJson[] = rows.map(toAdminBoardUserJson);
    return NextResponse.json(users);
  }

  const users = await prisma.boardUser.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManageUsers");
  if (denied) return denied;

  const json = (await request.json()) as unknown;
  const parsed = postInviteUserBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const name = parsed.data.name.trim();
  const { role } = parsed.data;
  let positionCode: string | null =
    parsed.data.positionCode?.trim() || null;
  if (positionCode === "") positionCode = null;

  if (positionCode) {
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

  const dup = await prisma.boardUser.findFirst({
    where: {
      tenantId: session.user.tenantId,
      email: { equals: email, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (dup) {
    return NextResponse.json(
      { error: "Email already in use for this organization" },
      { status: 409 },
    );
  }

  const userLimit = await checkPlanLimit(session.user.tenantId, "ADD_USER");
  if (!userLimit.allowed) {
    return planLimitForbiddenResponse(userLimit);
  }

  const perms = getDefaultPermissions(role);
  const passwordSetupExpires = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  );

  let passwordSetupToken = newPasswordSetupToken();
  for (let i = 0; i < 5; i++) {
    try {
      const created = await prisma.boardUser.create({
        data: {
          tenantId: session.user.tenantId,
          email,
          name,
          role,
          positionCode,
          password: null,
          passwordSetupToken,
          passwordSetupExpires,
          isActive: true,
          ...perms,
        },
        select: adminBoardUserSelect,
      });
      const userJson = toAdminBoardUserJson(created);
      const setupUrl = `/login/set-password?token=${encodeURIComponent(passwordSetupToken)}`;

      console.log("Email skipped:", {
        to: email,
        subject: "CCOS user invite",
      });

      return NextResponse.json(
        { user: userJson, setupUrl },
        { status: 201 },
      );
    } catch (e: unknown) {
      const code =
        typeof e === "object" && e !== null && "code" in e
          ? (e as { code?: string }).code
          : undefined;
      if (code === "P2002") {
        passwordSetupToken = newPasswordSetupToken();
        continue;
      }
      throw e;
    }
  }

  return NextResponse.json(
    { error: "Could not generate invite token" },
    { status: 500 },
  );
}

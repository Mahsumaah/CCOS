import { randomBytes } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { adminBoardUserSelect, toAdminBoardUserJson } from "@/lib/admin-board-user";
import { absoluteAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession } from "@/lib/rbac";

function newPasswordSetupToken(): string {
  return randomBytes(24).toString("base64url");
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManageUsers");
  if (denied) return denied;

  const { id: targetId } = await context.params;
  if (!targetId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const existing = await prisma.boardUser.findFirst({
    where: { id: targetId, tenantId: session.user.tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      password: true,
      isActive: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!existing.isActive) {
    return NextResponse.json(
      { error: "Cannot issue invite link for inactive user" },
      { status: 400 },
    );
  }

  if (existing.password) {
    return NextResponse.json(
      { error: "User already has a password" },
      { status: 400 },
    );
  }

  const passwordSetupExpires = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  );

  let passwordSetupToken = newPasswordSetupToken();
  type UpdatedUser = Prisma.BoardUserGetPayload<{
    select: typeof adminBoardUserSelect;
  }>;
  let updatedRow: UpdatedUser | null = null;

  for (let i = 0; i < 5; i++) {
    try {
      updatedRow = await prisma.boardUser.update({
        where: { id: targetId },
        data: {
          passwordSetupToken,
          passwordSetupExpires,
        },
        select: adminBoardUserSelect,
      });
      break;
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

  if (!updatedRow) {
    return NextResponse.json(
      { error: "Could not generate invite token" },
      { status: 500 },
    );
  }

  const emailLocale = "ar" as const;
  const fullSetupUrl = absoluteAppUrl(
    emailLocale,
    `/login/set-password?token=${encodeURIComponent(passwordSetupToken)}`,
  );
  const to = existing.email?.trim();
  if (to) {
    console.log("Email skipped:", {
      to,
      subject: "CCOS user invite (new setup link)",
    });
  }

  const setupUrl = `/login/set-password?token=${encodeURIComponent(passwordSetupToken)}`;

  return NextResponse.json({
    user: toAdminBoardUserJson(updatedRow),
    setupUrl,
    setupFullUrl: fullSetupUrl,
  });
}

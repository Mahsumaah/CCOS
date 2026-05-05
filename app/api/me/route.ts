import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getRoleLabel } from "@/lib/board-roles";
import { getEffectivePermissions, requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { patchMeBodySchema } from "@/lib/validations/me-api";

export async function GET() {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const user = await prisma.boardUser.findFirst({
    where: { id: session.user.id, tenantId: session.user.tenantId },
    include: {
      tenant: { select: { name: true } },
      position: { select: { labelAr: true, labelEn: true, code: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const roleLabelAr = getRoleLabel(user.role, "ar");
  const roleLabelEn = getRoleLabel(user.role, "en");

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabelAr,
    roleLabelEn,
    positionCode: user.positionCode,
    positionLabelAr: user.position?.labelAr ?? null,
    positionLabelEn: user.position?.labelEn ?? null,
    avatar: user.avatar,
    tenantName: user.tenant.name,
    permissions: getEffectivePermissions(user),
  });
}

export async function PATCH(request: Request) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchMeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  if (data.name !== undefined) {
    await prisma.boardUser.update({
      where: { id: session.user.id },
      data: { name: data.name.trim() },
    });
    return NextResponse.json({ ok: true, updated: "profile" });
  }

  if (data.currentPassword && data.newPassword) {
    const user = await prisma.boardUser.findFirst({
      where: { id: session.user.id, tenantId: session.user.tenantId },
      select: { id: true, password: true },
    });
    if (!user?.password) {
      return NextResponse.json(
        { error: "Password not set for this account" },
        { status: 400 },
      );
    }

    const valid = await bcrypt.compare(data.currentPassword, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid current password" },
        { status: 400 },
      );
    }

    const hash = await bcrypt.hash(data.newPassword, 12);
    await prisma.boardUser.update({
      where: { id: user.id },
      data: { password: hash },
    });
    return NextResponse.json({ ok: true, updated: "password" });
  }

  return NextResponse.json({ error: "Invalid body" }, { status: 400 });
}

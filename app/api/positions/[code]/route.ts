import { NextResponse } from "next/server";

import { requirePermission, requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { patchPositionBodySchema } from "@/lib/validations/position-apis";

function normalizeCode(raw: string) {
  return decodeURIComponent(raw).trim().toUpperCase();
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManagePositions");
  if (denied) return denied;

  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode);

  const json = (await request.json()) as unknown;
  const parsed = patchPositionBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.organizationalPosition.findUnique({
    where: { code },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const position = await prisma.organizationalPosition.update({
    where: { code },
    data: parsed.data,
  });

  return NextResponse.json({ position });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManagePositions");
  if (denied) return denied;

  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode);

  const existing = await prisma.organizationalPosition.findUnique({
    where: { code },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assigned = await prisma.boardUser.count({
    where: { positionCode: code },
  });
  if (assigned > 0) {
    return NextResponse.json(
      {
        error: "POSITION_HAS_USERS",
        messageAr: "لا يمكن حذف منصب مرتبط بمستخدمين",
        messageEn: "Cannot delete position assigned to users",
      },
      { status: 409 },
    );
  }

  await prisma.organizationalPosition.delete({ where: { code } });
  return NextResponse.json({ ok: true });
}

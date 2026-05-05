import { NextResponse } from "next/server";

import { requirePermission, requireSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createPositionBodySchema } from "@/lib/validations/position-apis";

export async function GET() {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManagePositions");
  if (denied) return denied;

  const positions = await prisma.organizationalPosition.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ positions });
}

export async function POST(request: Request) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManagePositions");
  if (denied) return denied;

  const json = (await request.json()) as unknown;
  const parsed = createPositionBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    const position = await prisma.organizationalPosition.create({
      data: {
        code: data.code,
        labelAr: data.labelAr,
        labelEn: data.labelEn,
        level: data.level,
        category: data.category,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      },
    });
    return NextResponse.json({ position }, { status: 201 });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code?: string }).code
        : undefined;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "DUPLICATE_CODE", message: "Position code already exists" },
        { status: 409 },
      );
    }
    throw e;
  }
}

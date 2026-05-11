import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("token");
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Invalid or expired" }, { status: 400 });
  }

  const user = await prisma.boardUser.findUnique({
    where: { passwordSetupToken: token },
    select: {
      name: true,
      email: true,
      passwordSetupExpires: true,
    },
  });

  if (!user?.passwordSetupExpires) {
    return NextResponse.json({ error: "Invalid or expired" }, { status: 400 });
  }

  if (user.passwordSetupExpires.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Invalid or expired" }, { status: 400 });
  }

  return NextResponse.json({
    name: user.name,
    email: user.email,
  });
}

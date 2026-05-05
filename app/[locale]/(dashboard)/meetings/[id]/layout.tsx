import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return { title: "Meeting" };
  }
  const row = await prisma.meeting.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { title: true },
  });
  return { title: row?.title ?? "Meeting" };
}

export default function MeetingDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

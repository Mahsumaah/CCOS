import { prisma } from "@/lib/prisma";

export async function getLivePresentUserIds(liveSessionId: string, tenantId: string) {
  const rows = await prisma.liveParticipantSession.findMany({
    where: { liveSessionId, tenantId, leftAt: null },
    select: { userId: true },
  });
  return [...new Set(rows.map((r) => r.userId))];
}

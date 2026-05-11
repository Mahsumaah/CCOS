import type { AuditAction, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function writeAuditLog(params: {
  tenantId: string;
  meetingId?: string | null;
  liveSessionId?: string | null;
  liveVoteId?: string | null;
  liveDecisionEventId?: string | null;
  actorId?: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  payloadJson?: Prisma.InputJsonValue;
}) {
  return prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      meetingId: params.meetingId ?? null,
      liveSessionId: params.liveSessionId ?? null,
      liveVoteId: params.liveVoteId ?? null,
      liveDecisionEventId: params.liveDecisionEventId ?? null,
      actorId: params.actorId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      payloadJson: params.payloadJson,
    },
  });
}

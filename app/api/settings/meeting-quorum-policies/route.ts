import { MeetingType, QuorumRuleMode } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission, requireSession } from "@/lib/rbac";
import { MEETING_TYPES } from "@/lib/meeting-types";
import { prisma } from "@/lib/prisma";

const policyRowSchema = z.object({
  meetingType: z.nativeEnum(MeetingType),
  quorumRequired: z.boolean(),
  ruleMode: z.nativeEnum(QuorumRuleMode),
  minAttendancePercent: z.number().int().min(1).max(100).nullable().optional(),
  optionsJson: z.any().nullable().optional(),
});

const putBodySchema = z.array(policyRowSchema).superRefine((arr, ctx) => {
  if (arr.length !== MEETING_TYPES.length) {
    ctx.addIssue({
      code: "custom",
      message: `Expected ${MEETING_TYPES.length} rows`,
    });
    return;
  }
  const set = new Set(arr.map((a) => a.meetingType));
  if (set.size !== MEETING_TYPES.length) {
    ctx.addIssue({
      code: "custom",
      message: "Each meeting type must appear exactly once",
    });
  }
});

export async function GET() {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManagePositions");
  if (denied) return denied;

  const rows = await prisma.meetingTypeQuorumPolicy.findMany();
  const byType = new Map(rows.map((r) => [r.meetingType, r]));

  const policies = MEETING_TYPES.map((meetingType) => {
    const row = byType.get(meetingType);
    if (!row) {
      return {
        meetingType,
        quorumRequired: true,
        ruleMode: QuorumRuleMode.ABSOLUTE_MAJORITY,
        minAttendancePercent: null as number | null,
        optionsJson: null as unknown | null,
      };
    }
    return {
      meetingType: row.meetingType,
      quorumRequired: row.quorumRequired,
      ruleMode: row.ruleMode,
      minAttendancePercent: row.minAttendancePercent,
      optionsJson: row.optionsJson,
    };
  });

  return NextResponse.json({ policies });
}

export async function PUT(request: Request) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const denied = requirePermission(session, "permManagePositions");
  if (denied) return denied;

  const json = (await request.json()) as unknown;
  const parsed = putBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const rows = parsed.data;

  for (const r of rows) {
    if (r.ruleMode === "MIN_PERCENT") {
      const p = r.minAttendancePercent;
      if (p == null || p < 1 || p > 100) {
        return NextResponse.json(
          {
            error:
              "minAttendancePercent is required (1–100) when ruleMode is MIN_PERCENT",
          },
          { status: 400 },
        );
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.meetingTypeQuorumPolicy.deleteMany({});
    for (const r of rows) {
      await tx.meetingTypeQuorumPolicy.create({
        data: {
          meetingType: r.meetingType,
          quorumRequired: r.quorumRequired,
          ruleMode: r.ruleMode,
          minAttendancePercent:
            r.ruleMode === "MIN_PERCENT" ? (r.minAttendancePercent ?? 50) : null,
          optionsJson:
            r.optionsJson == null
              ? undefined
              : (r.optionsJson as Prisma.InputJsonValue),
        },
      });
    }
  });

  const policies = await prisma.meetingTypeQuorumPolicy.findMany();
  return NextResponse.json({ policies });
}

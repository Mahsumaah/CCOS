import {
  BoardRole,
  MeetingType,
  Plan,
  PrismaClient,
  QuorumRuleMode,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@2024", 12);
  const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const tenant = await prisma.tenant.upsert({
    where: { slug: "ccos-demo" },
    create: {
      name: "CCOS Demo Organization",
      slug: "ccos-demo",
      plan: Plan.TRIAL,
      trialEndsAt,
    },
    update: {
      name: "CCOS Demo Organization",
      plan: Plan.TRIAL,
      trialEndsAt,
    },
  });

  await prisma.boardUser.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "admin@ccos.app",
      },
    },
    create: {
      tenantId: tenant.id,
      email: "admin@ccos.app",
      password: passwordHash,
      name: "مدير النظام",
      role: BoardRole.CHAIR,
      permCreateMeetings: true,
      permEditMeetings: true,
      permManageMeetings: true,
      permCreateVotes: true,
      permCastVotes: true,
      permCreateDecisions: true,
      permEditDecisions: true,
      permFinalizeMinutes: true,
      permManagePositions: true,
      permManageUsers: true,
    },
    update: {
      password: passwordHash,
      name: "مدير النظام",
      role: BoardRole.CHAIR,
      permCreateMeetings: true,
      permEditMeetings: true,
      permManageMeetings: true,
      permCreateVotes: true,
      permCastVotes: true,
      permCreateDecisions: true,
      permEditDecisions: true,
      permFinalizeMinutes: true,
      permManagePositions: true,
      permManageUsers: true,
    },
  });

  const quorumTypes = [
    MeetingType.BOARD,
    MeetingType.EMERGENCY,
    MeetingType.ASSEMBLY,
  ] as const;

  for (const meetingType of quorumTypes) {
    await prisma.meetingTypeQuorumPolicy.upsert({
      where: { meetingType },
      create: {
        meetingType,
        quorumRequired: true,
        ruleMode: QuorumRuleMode.ABSOLUTE_MAJORITY,
      },
      update: {
        quorumRequired: true,
        ruleMode: QuorumRuleMode.ABSOLUTE_MAJORITY,
      },
    });
  }
}

main()
  .then(() => {
    console.log("Seed completed.");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

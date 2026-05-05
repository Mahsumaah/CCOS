import { randomBytes } from "node:crypto";

import { MeetingType, QuorumRuleMode } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { registerApiBodySchema } from "@/lib/validations/register";

function slugifyOrganizationName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base.length >= 2 ? base : "organization";
}

function randomSlugSuffix(): string {
  return randomBytes(2).toString("hex").slice(0, 4);
}

function registerErrors(locale: "ar" | "en") {
  const ar = {
    emailInUse: "البريد مستخدم بالفعل",
    validation: "بيانات غير صالحة",
    slugConflict: "تعذر إنشاء معرف للمنظمة. حاول مرة أخرى.",
    failed: "تعذر إنشاء الحساب",
  };
  const en = {
    emailInUse: "Email already in use",
    validation: "Invalid registration data",
    slugConflict: "Could not allocate an organization URL. Please try again.",
    failed: "Could not create account",
  };
  return locale === "ar" ? ar : en;
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = registerApiBodySchema.safeParse(json);
  const locale = parsed.success ? parsed.data.locale : "ar";
  const err = registerErrors(locale);

  if (!parsed.success) {
    return NextResponse.json(
      { error: err.validation, details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { organizationName, name, email, password } = parsed.data;
  const emailNorm = email.trim().toLowerCase();

  const existingUser = await prisma.boardUser.findFirst({
    where: { email: { equals: emailNorm, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingUser) {
    return NextResponse.json({ error: err.emailInUse }, { status: 400 });
  }

  let baseSlug = slugifyOrganizationName(organizationName);
  let slug = baseSlug;
  const maxAttempts = 24;
  let attempt = 0;

  while (attempt < maxAttempts) {
    const clash = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!clash) break;
    slug = `${baseSlug}-${randomSlugSuffix()}`;
    attempt += 1;
  }

  if (attempt >= maxAttempts) {
    return NextResponse.json({ error: err.slugConflict }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const quorumTypes = [
    MeetingType.BOARD,
    MeetingType.EMERGENCY,
    MeetingType.ASSEMBLY,
  ] as const;

  try {
    await prisma.$transaction(async (tx) => {
      const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const tenant = await tx.tenant.create({
        data: {
          name: organizationName.trim(),
          slug,
          plan: "TRIAL",
          trialEndsAt,
        },
      });

      await tx.boardUser.create({
        data: {
          tenantId: tenant.id,
          email: emailNorm,
          name: name.trim(),
          password: passwordHash,
          role: "CHAIR",
          isActive: true,
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

      for (const meetingType of quorumTypes) {
        await tx.meetingTypeQuorumPolicy.upsert({
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
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: err.failed }, { status: 500 });
  }

  return NextResponse.json({ success: true, tenantSlug: slug });
}

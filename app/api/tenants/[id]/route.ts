import { NextResponse } from "next/server";

import { getPlanLimits } from "@/lib/plan-limits-config";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";
import { canManageTenantSettings } from "@/lib/tenant-settings-permission";
import { patchTenantBodySchema } from "@/lib/validations/tenant-settings";

type RouteContext = { params: Promise<{ id: string }> };

function startOfUtcMonth(d: Date): Date {
  const x = new Date(d);
  x.setUTCDate(1);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function finiteCap(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}

export async function GET(_request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  if (!canManageTenantSettings(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id || id !== session.user.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      plan: true,
      trialEndsAt: true,
      defaultLocale: true,
      createdAt: true,
    },
  });

  if (!tenant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const monthStart = startOfUtcMonth(now);

  const [memberCount, meetingsThisMonth] = await Promise.all([
    prisma.boardUser.count({ where: { tenantId: id, isActive: true } }),
    prisma.meeting.count({
      where: {
        tenantId: id,
        createdAt: { gte: monthStart },
      },
    }),
  ]);

  const limits = getPlanLimits(tenant.plan);

  return NextResponse.json({
    ...tenant,
    usage: {
      memberCount,
      memberLimit: finiteCap(limits.maxUsers),
      meetingsThisMonth,
      meetingsPerMonthLimit: finiteCap(limits.maxMeetingsPerMonth),
    },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  if (!canManageTenantSettings(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id || id !== session.user.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchTenantBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, logo, defaultLocale } = parsed.data;
  if (name === undefined && logo === undefined && defaultLocale === undefined) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 },
    );
  }

  const data: {
    name?: string;
    logo?: string | null;
    defaultLocale?: string;
  } = {};

  if (name !== undefined) data.name = name;
  if (defaultLocale !== undefined) data.defaultLocale = defaultLocale;
  if (logo !== undefined) {
    data.logo = logo === "" || logo === null ? null : logo;
  }

  try {
    const updated = await prisma.tenant.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        plan: true,
        defaultLocale: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not update tenant" },
      { status: 500 },
    );
  }
}

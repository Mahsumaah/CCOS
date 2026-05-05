import { NextResponse } from "next/server";

import { isTrialExpired } from "@/lib/trial";
import { prisma } from "@/lib/prisma";
import { getPlanLimits } from "@/lib/plan-limits-config";

export type { PlanLimitsState } from "@/lib/plan-limits-config";
export {
  PLAN_LIMITS,
  getPlanLimits,
  ADDITIONAL_USER_PRICE,
} from "@/lib/plan-limits-config";

export type PlanLimitAction =
  | "ADD_USER"
  | "CREATE_MEETING"
  | "EXPORT_DOCX"
  | "SIGN"
  | "DELEGATE";

function startOfUtcMonth(d: Date): Date {
  const x = new Date(d);
  x.setUTCDate(1);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export type PlanLimitCheckResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: string;
      reasonAr: string;
      code: string;
    };

export async function checkPlanLimit(
  tenantId: string,
  action: PlanLimitAction,
): Promise<PlanLimitCheckResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, trialEndsAt: true },
  });
  if (!tenant) {
    return {
      allowed: false,
      reason: "Organization not found",
      reasonAr: "المؤسسة غير موجودة",
      code: "TENANT_NOT_FOUND",
    };
  }

  if (isTrialExpired(tenant)) {
    return {
      allowed: false,
      reason: "Your free trial has expired. Choose a plan to continue using CCOS.",
      reasonAr: "انتهت الفترة التجريبية المجانية. اختر خطة للاستمرار في استخدام CCOS.",
      code: "TRIAL_EXPIRED",
    };
  }

  const limits = getPlanLimits(tenant.plan);

  switch (action) {
    case "ADD_USER": {
      const n = await prisma.boardUser.count({
        where: { tenantId, isActive: true },
      });
      if (!Number.isFinite(limits.maxUsers) || n < limits.maxUsers) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "You've reached the maximum users for your plan",
        reasonAr: "تم الوصول للحد الأقصى من المستخدمين في خطتك",
        code: "MAX_USERS",
      };
    }
    case "CREATE_MEETING": {
      const monthStart = startOfUtcMonth(new Date());
      const count = await prisma.meeting.count({
        where: { tenantId, createdAt: { gte: monthStart } },
      });
      if (
        !Number.isFinite(limits.maxMeetingsPerMonth) ||
        count < limits.maxMeetingsPerMonth
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "You've reached the monthly meetings limit",
        reasonAr: "تم الوصول للحد الأقصى من الاجتماعات الشهرية",
        code: "MAX_MEETINGS_MONTH",
      };
    }
    case "EXPORT_DOCX":
      if (limits.canExportDocx) return { allowed: true };
      return {
        allowed: false,
        reason: "Upgrade your plan to export minutes (Word).",
        reasonAr: "رقِّ خطتك لتصدير المحاضر بصيغة Word.",
        code: "EXPORT_DOCX",
      };
    case "SIGN":
      if (limits.canSign) return { allowed: true };
      return {
        allowed: false,
        reason: "Upgrade your plan to sign minutes electronically.",
        reasonAr: "رقِّ خطتك للتوقيع الإلكتروني على المحاضر.",
        code: "SIGN_MINUTES",
      };
    case "DELEGATE":
      if (limits.canDelegate) return { allowed: true };
      return {
        allowed: false,
        reason: "Upgrade your plan to use meeting delegations.",
        reasonAr: "رقِّ خطتك لاستخدام التفويض في الاجتماعات.",
        code: "DELEGATE",
      };
    default:
      return { allowed: true };
  }
}

export function planLimitForbiddenResponse(
  result: Extract<PlanLimitCheckResult, { allowed: false }>,
) {
  return NextResponse.json(
    {
      error: result.reason,
      errorAr: result.reasonAr,
      upgradeRequired: true,
      code: result.code,
    },
    { status: 403 },
  );
}

export type { PlanLimitApiBody } from "@/lib/plan-limits-config";
export { planLimitMessageFromBody } from "@/lib/plan-limits-config";

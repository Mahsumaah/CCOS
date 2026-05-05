import type { Plan } from "@prisma/client";

export type PlanLimitsState = {
  maxUsers: number;
  maxMeetingsPerMonth: number;
  canExportDocx: boolean;
  canSign: boolean;
  canDelegate: boolean;
  canCustomBrand: boolean;
  /** Trial-only: length of trial in days (for display / product rules). */
  durationDays?: number;
};

export const PLAN_LIMITS: Record<Plan, PlanLimitsState> = {
  TRIAL: {
    maxUsers: 7,
    maxMeetingsPerMonth: Number.POSITIVE_INFINITY,
    canExportDocx: true,
    canSign: true,
    canDelegate: true,
    canCustomBrand: false,
    durationDays: 3,
  },
  STARTER: {
    maxUsers: 7,
    maxMeetingsPerMonth: Number.POSITIVE_INFINITY,
    canExportDocx: true,
    canSign: false,
    canDelegate: false,
    canCustomBrand: false,
  },
  PROFESSIONAL: {
    maxUsers: 12,
    maxMeetingsPerMonth: Number.POSITIVE_INFINITY,
    canExportDocx: true,
    canSign: true,
    canDelegate: true,
    canCustomBrand: false,
  },
  ENTERPRISE: {
    maxUsers: 18,
    maxMeetingsPerMonth: Number.POSITIVE_INFINITY,
    canExportDocx: true,
    canSign: true,
    canDelegate: true,
    canCustomBrand: true,
  },
};

export const ADDITIONAL_USER_PRICE = {
  monthly: 34,
  yearly: 408,
  currency: "SAR",
} as const;

export function getPlanLimits(plan: Plan): PlanLimitsState {
  return PLAN_LIMITS[plan];
}

export type PlanLimitApiBody = {
  error?: string;
  errorAr?: string;
  upgradeRequired?: boolean;
  code?: string;
};

export function planLimitMessageFromBody(
  body: PlanLimitApiBody,
  locale: "ar" | "en",
): string | null {
  if (!body.upgradeRequired) return null;
  if (locale === "ar") {
    return (body.errorAr ?? body.error)?.trim() || null;
  }
  return (body.error ?? body.errorAr)?.trim() || null;
}

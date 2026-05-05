import type { Plan } from "@prisma/client";

export type TrialTenantFields = {
  plan: Plan;
  trialEndsAt: Date | string | null;
};

export function isTrialExpired(tenant: TrialTenantFields): boolean {
  if (tenant.plan !== "TRIAL") return false;
  if (!tenant.trialEndsAt) return false;
  return new Date() > new Date(tenant.trialEndsAt);
}

export function getTrialDaysRemaining(
  tenant: TrialTenantFields,
): number | null {
  if (tenant.plan !== "TRIAL") return null;
  if (!tenant.trialEndsAt) return null;
  const diff = new Date(tenant.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

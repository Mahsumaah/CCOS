import type { BoardRole } from "@prisma/client";

/** Organization settings (`/settings`) and tenant API. */
export function canManageTenantSettings(user: {
  role: BoardRole;
  permManageUsers: boolean;
}): boolean {
  return user.role === "CHAIR" || user.permManageUsers;
}

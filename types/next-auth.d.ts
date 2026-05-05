import type { BoardRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: BoardRole;
    tenantId: string;
    tenantSlug: string;
    tenantName?: string;
    permManageUsers: boolean;
    permCreateMeetings: boolean;
    permEditMeetings: boolean;
    permManageMeetings: boolean;
    permCreateVotes: boolean;
    permCastVotes: boolean;
    permCreateDecisions: boolean;
    permEditDecisions: boolean;
    permFinalizeMinutes: boolean;
    permManagePositions: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: BoardRole;
      tenantId: string;
      tenantSlug: string;
      tenantName: string;
      permManageUsers: boolean;
      permCreateMeetings: boolean;
      permEditMeetings: boolean;
      permManageMeetings: boolean;
      permCreateVotes: boolean;
      permCastVotes: boolean;
      permCreateDecisions: boolean;
      permEditDecisions: boolean;
      permFinalizeMinutes: boolean;
      permManagePositions: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: BoardRole;
    tenantId?: string;
    tenantSlug?: string;
    tenantName?: string;
    permManageUsers?: boolean;
    permCreateMeetings?: boolean;
    permEditMeetings?: boolean;
    permManageMeetings?: boolean;
    permCreateVotes?: boolean;
    permCastVotes?: boolean;
    permCreateDecisions?: boolean;
    permEditDecisions?: boolean;
    permFinalizeMinutes?: boolean;
    permManagePositions?: boolean;
  }
}

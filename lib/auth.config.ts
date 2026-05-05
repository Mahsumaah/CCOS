import type { BoardRole } from "@prisma/client";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { prisma } = await import("./prisma");
        const bcrypt = (await import("bcryptjs")).default;

        const user = await prisma.boardUser.findFirst({
          where: {
            email: credentials.email as string,
            isActive: true,
          },
          include: { tenant: true },
        });

        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );

        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
          tenantName: user.tenant.name,
          permManageUsers: user.permManageUsers,
          permCreateMeetings: user.permCreateMeetings,
          permEditMeetings: user.permEditMeetings,
          permManageMeetings: user.permManageMeetings,
          permCreateVotes: user.permCreateVotes,
          permCastVotes: user.permCastVotes,
          permCreateDecisions: user.permCreateDecisions,
          permEditDecisions: user.permEditDecisions,
          permFinalizeMinutes: user.permFinalizeMinutes,
          permManagePositions: user.permManagePositions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as BoardRole;
        token.tenantId = user.tenantId;
        token.tenantSlug = user.tenantSlug;
        token.tenantName = user.tenantName;
        token.permManageUsers = user.permManageUsers;
        token.permCreateMeetings = user.permCreateMeetings;
        token.permEditMeetings = user.permEditMeetings;
        token.permManageMeetings = user.permManageMeetings;
        token.permCreateVotes = user.permCreateVotes;
        token.permCastVotes = user.permCastVotes;
        token.permCreateDecisions = user.permCreateDecisions;
        token.permEditDecisions = user.permEditDecisions;
        token.permFinalizeMinutes = user.permFinalizeMinutes;
        token.permManagePositions = user.permManagePositions;
      } else if (
        token.id &&
        (token.permCreateMeetings === undefined ||
          token.permEditMeetings === undefined ||
          token.permManageMeetings === undefined ||
          token.permCreateVotes === undefined ||
          token.permCastVotes === undefined ||
          token.permCreateDecisions === undefined ||
          token.permEditDecisions === undefined ||
          token.permFinalizeMinutes === undefined ||
          token.permManagePositions === undefined)
      ) {
        const { prisma } = await import("./prisma");
        const u = await prisma.boardUser.findFirst({
          where: { id: token.id as string, isActive: true },
          select: {
            permManageUsers: true,
            permCreateMeetings: true,
            permEditMeetings: true,
            permManageMeetings: true,
            permCreateVotes: true,
            permCastVotes: true,
            permCreateDecisions: true,
            permEditDecisions: true,
            permFinalizeMinutes: true,
            permManagePositions: true,
            tenant: { select: { name: true, slug: true } },
          },
        });
        if (u) {
          token.tenantName = u.tenant.name;
          token.tenantSlug = u.tenant.slug;
          token.permManageUsers = u.permManageUsers;
          token.permCreateMeetings = u.permCreateMeetings;
          token.permEditMeetings = u.permEditMeetings;
          token.permManageMeetings = u.permManageMeetings;
          token.permCreateVotes = u.permCreateVotes;
          token.permCastVotes = u.permCastVotes;
          token.permCreateDecisions = u.permCreateDecisions;
          token.permEditDecisions = u.permEditDecisions;
          token.permFinalizeMinutes = u.permFinalizeMinutes;
          token.permManagePositions = u.permManagePositions;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as BoardRole;
        session.user.tenantId = token.tenantId as string;
        session.user.tenantSlug = token.tenantSlug as string;
        session.user.tenantName =
          (token.tenantName as string | undefined) ?? "";
        session.user.permManageUsers = Boolean(token.permManageUsers);
        session.user.permCreateMeetings = Boolean(token.permCreateMeetings);
        session.user.permEditMeetings = Boolean(token.permEditMeetings);
        session.user.permManageMeetings = Boolean(token.permManageMeetings);
        session.user.permCreateVotes = Boolean(token.permCreateVotes);
        session.user.permCastVotes = Boolean(token.permCastVotes);
        session.user.permCreateDecisions = Boolean(token.permCreateDecisions);
        session.user.permEditDecisions = Boolean(token.permEditDecisions);
        session.user.permFinalizeMinutes = Boolean(token.permFinalizeMinutes);
        session.user.permManagePositions = Boolean(token.permManagePositions);
      }
      return session;
    },
  },
  pages: {
    signIn: "/ar/login",
  },
  session: { strategy: "jwt" },
};

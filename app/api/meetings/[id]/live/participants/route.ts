import { LiveSessionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { currentLiveRoleForUser, ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { boardRoleToLiveRole, hasLiveCapability } from "@/lib/live-permissions";
import { getLiveKitRoomService } from "@/lib/livekit";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id: meetingId } = await context.params;
  const access = await ensureMeetingLiveAccess({
    meetingId,
    tenantId: session.user.tenantId,
    userId: session.user.id,
    sessionUser: {
      role: session.user.role,
      permManageMeetings: session.user.permManageMeetings,
    },
  });
  if (!access.ok) return access.response;

  const url = new URL(request.url);
  const reconcileRequested = url.searchParams.get("reconcile") === "1";

  const liveRole = currentLiveRoleForUser(session.user.role);
  const mayReconcile =
    session.user.permManageMeetings || hasLiveCapability(liveRole, "canModerateMedia");

  const liveSession = await prisma.liveSession.findFirst({
    where: { meetingId, tenantId: session.user.tenantId },
    orderBy: { createdAt: "desc" },
  });

  if (!liveSession) {
    return NextResponse.json({ participants: [], history: [], liveSession: null });
  }

  if (reconcileRequested) {
    if (!mayReconcile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (liveSession.status !== LiveSessionStatus.LIVE) {
      return NextResponse.json(
        { error: "reconcile_only_when_live", liveSessionId: liveSession.id },
        { status: 400 },
      );
    }
    try {
      const roomService = getLiveKitRoomService();
      const lkParticipants = await roomService.listParticipants(liveSession.roomName);
      const liveIdentities = new Set(
        lkParticipants.map((p) => p.identity).filter(Boolean) as string[],
      );

      const openRows = await prisma.liveParticipantSession.findMany({
        where: {
          liveSessionId: liveSession.id,
          tenantId: session.user.tenantId,
          leftAt: null,
        },
      });

      const now = new Date();
      for (const row of openRows) {
        if (!liveIdentities.has(row.userId)) {
          await prisma.liveParticipantSession.update({
            where: { id: row.id },
            data: { leftAt: now },
          });
        }
      }

      for (const identity of liveIdentities) {
        const user = await prisma.boardUser.findFirst({
          where: { id: identity, tenantId: session.user.tenantId },
          select: { id: true, role: true },
        });
        if (!user) continue;
        const open = await prisma.liveParticipantSession.findFirst({
          where: {
            liveSessionId: liveSession.id,
            userId: identity,
            leftAt: null,
          },
        });
        if (!open) {
          const latest = await prisma.liveParticipantSession.findFirst({
            where: { liveSessionId: liveSession.id, userId: identity },
            orderBy: { joinedAt: "desc" },
          });
          if (latest?.leftAt) {
            await prisma.liveParticipantSession.update({
              where: { id: latest.id },
              data: { leftAt: null, reconnectCount: { increment: 1 } },
            });
          } else if (!latest) {
            await prisma.liveParticipantSession.create({
              data: {
                tenantId: session.user.tenantId,
                meetingId,
                liveSessionId: liveSession.id,
                userId: identity,
                role: boardRoleToLiveRole(user.role),
              },
            });
          }
        }
      }
    } catch (e) {
      console.error("[live/participants] reconcile error", e);
      return NextResponse.json({ error: "reconcile_failed" }, { status: 502 });
    }
  }

  const [active, history] = await Promise.all([
    prisma.liveParticipantSession.findMany({
      where: { liveSessionId: liveSession.id, tenantId: session.user.tenantId, leftAt: null },
      orderBy: [{ raisedHandAt: "desc" }, { joinedAt: "asc" }],
      include: {
        user: { select: { id: true, name: true, role: true, email: true } },
      },
    }),
    prisma.liveParticipantSession.findMany({
      where: {
        liveSessionId: liveSession.id,
        tenantId: session.user.tenantId,
        leftAt: { not: null },
      },
      orderBy: { leftAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, name: true, role: true, email: true } },
      },
    }),
  ]);

  return NextResponse.json({
    liveSession: {
      id: liveSession.id,
      status: liveSession.status,
      roomName: liveSession.roomName,
    },
    participants: active,
    history,
  });
}

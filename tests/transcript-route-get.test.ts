import { describe, expect, it, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => ({
  findMany: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    liveSession: { findFirst: vi.fn() },
    transcriptSegment: { findMany: hoisted.findMany },
  },
}));

vi.mock("@/lib/rbac", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/live-meeting", () => ({
  ensureMeetingLiveAccess: vi.fn(),
}));

import { GET } from "@/app/api/meetings/[id]/live/transcript/route";
import { prisma } from "@/lib/prisma";
import { ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { requireSession } from "@/lib/rbac";

describe("GET /api/meetings/[id]/live/transcript", () => {
  beforeEach(() => {
    vi.mocked(requireSession).mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "user-1",
          tenantId: "tenant-z",
          permFinalizeMinutes: true,
          permManageMeetings: false,
        },
      } as never,
    });
    vi.mocked(ensureMeetingLiveAccess).mockResolvedValue({
      ok: true,
      meeting: { id: "meet-1", status: "LIVE" as never, title: "T" },
    } as never);
    hoisted.findMany.mockClear();
  });

  it("scopes transcript segments by tenantId and meetingId", async () => {
    const req = new Request("http://localhost/api/meetings/meet-1/live/transcript");
    const res = await GET(req, { params: Promise.resolve({ id: "meet-1" }) });
    expect(res.status).toBe(200);
    expect(prisma.transcriptSegment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          meetingId: "meet-1",
          tenantId: "tenant-z",
        }),
      }),
    );
  });
});

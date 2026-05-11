import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const hoisted = vi.hoisted(() => ({
  openRouterChatCompletion: vi.fn().mockResolvedValue({
    content: "# Draft\n\n- Point",
    model: "test/model",
  }),
}));

vi.mock("@/lib/openrouter", () => ({
  isOpenRouterConfigured: vi.fn(() => true),
  openRouterChatCompletion: hoisted.openRouterChatCompletion,
}));

vi.mock("@/lib/audit-log", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rbac", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/live-meeting", () => ({
  ensureMeetingLiveAccess: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    liveSession: { findFirst: vi.fn().mockResolvedValue(null) },
    meeting: {
      findFirst: vi.fn().mockResolvedValue({ title: "Board meeting" }),
    },
    transcriptSegment: {
      findMany: vi.fn().mockResolvedValue([
        {
          text: "Motion to approve.",
          speakerName: "Chair",
          createdAt: new Date("2026-01-01T12:00:00Z"),
          liveSessionId: null,
        },
      ]),
    },
  },
}));

import { POST } from "@/app/api/meetings/[id]/live/ai/draft-minutes/route";
import { resetDraftRateLimitBucketsForTests } from "@/lib/ai-draft-rate-limit";
import { writeAuditLog } from "@/lib/audit-log";
import { ensureMeetingLiveAccess } from "@/lib/live-meeting";
import { requireSession } from "@/lib/rbac";

describe("POST /api/meetings/[id]/live/ai/draft-minutes", () => {
  const prevKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    resetDraftRateLimitBucketsForTests();
    hoisted.openRouterChatCompletion.mockClear();
    vi.mocked(writeAuditLog).mockClear();
    vi.mocked(requireSession).mockResolvedValue({
      ok: true,
      session: {
        user: {
          id: "user-draft",
          tenantId: "tenant-draft",
          permFinalizeMinutes: true,
          permManageMeetings: false,
        },
      } as never,
    });
    vi.mocked(ensureMeetingLiveAccess).mockResolvedValue({
      ok: true,
      meeting: { id: "m1", status: "LIVE" as never, title: "T" },
    } as never);
  });

  afterEach(() => {
    process.env.OPENROUTER_API_KEY = prevKey;
  });

  it("calls OpenRouter and records audit on success", async () => {
    const req = new Request(
      "http://localhost/api/meetings/m1/live/ai/draft-minutes?locale=en",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveSessionId: null }),
      },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "m1" }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { markdown?: string; model?: string };
    expect(body.markdown).toContain("Draft");
    expect(hoisted.openRouterChatCompletion).toHaveBeenCalledTimes(1);
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LIVE_AI_DRAFT_GENERATED",
        tenantId: "tenant-draft",
        meetingId: "m1",
      }),
    );
  });

  it("returns 429 after exceeding the rate limit", async () => {
    for (let i = 0; i < 8; i += 1) {
      const req = new Request(
        "http://localhost/api/meetings/m1/live/ai/draft-minutes?locale=en",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ liveSessionId: null }),
        },
      );
      const res = await POST(req, { params: Promise.resolve({ id: "m1" }) });
      expect(res.status).toBe(200);
    }
    const ninth = new Request(
      "http://localhost/api/meetings/m1/live/ai/draft-minutes?locale=en",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveSessionId: null }),
      },
    );
    const res429 = await POST(ninth, { params: Promise.resolve({ id: "m1" }) });
    expect(res429.status).toBe(429);
    const errBody = (await res429.json()) as { error?: string };
    expect(errBody.error).toBe("rate_limited");
    expect(hoisted.openRouterChatCompletion).toHaveBeenCalledTimes(8);
  });
});

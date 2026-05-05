import { format } from "date-fns";
import { NextResponse } from "next/server";

import { requireSession, userMayAccessMeeting } from "@/lib/rbac";
import { buildMinutesData } from "@/lib/minutes/build";
import { generateMinutesDocxBuffer } from "@/lib/minutes/export-docx";
import { checkPlanLimit, planLimitForbiddenResponse } from "@/lib/plan-limits";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

function parseLocale(request: Request): "ar" | "en" {
  const u = new URL(request.url);
  return u.searchParams.get("locale") === "en" ? "en" : "ar";
}

const PDF_NOT_AVAILABLE_MESSAGE =
  "PDF export not available. Please use Word export.";

export async function GET(request: Request, context: RouteContext) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;
  const { session } = gated;

  const { id: meetingId } = await context.params;
  const tenantId = session.user.tenantId;
  const url = new URL(request.url);

  if (url.searchParams.get("format") === "pdf") {
    return NextResponse.json(
      { message: PDF_NOT_AVAILABLE_MESSAGE },
      { status: 410 },
    );
  }

  const locale = parseLocale(request);

  const allowed = await userMayAccessMeeting(
    session.user.id,
    meetingId,
    tenantId,
    session.user,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const exportLimit = await checkPlanLimit(tenantId, "EXPORT_DOCX");
  if (!exportLimit.allowed) {
    return planLimitForbiddenResponse(exportLimit);
  }

  const minutes = await prisma.minutes.findUnique({
    where: { meetingId },
    select: { id: true },
  });
  if (!minutes) {
    return NextResponse.json({ error: "Minutes not generated" }, { status: 404 });
  }

  let data;
  try {
    data = await buildMinutesData(meetingId, tenantId, locale);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not build minutes export" },
      { status: 500 },
    );
  }

  let buf: Buffer;
  try {
    // DOCX builder loads tenant.logo (ImageKit HTTPS) and signature images via fetch; failures skip images.
    buf = await generateMinutesDocxBuffer(data, locale);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not generate document" },
      { status: 500 },
    );
  }

  const scheduled = data.meeting.scheduledAt;
  const dateStr = format(
    scheduled instanceof Date ? scheduled : new Date(scheduled),
    "yyyy-MM-dd",
  );
  const filename = `minutes-${dateStr}.docx`;

  return new NextResponse(new Uint8Array(Buffer.from(buf)), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

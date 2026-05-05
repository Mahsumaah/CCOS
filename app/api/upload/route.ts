import { NextResponse } from "next/server";

import { requireSession } from "@/lib/rbac";
import { getImageKit, isImageKitConfigured } from "@/lib/imagekit";

const MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_FOLDER = "/ccos";

function sanitizeFolder(raw: string | null): string {
  const t = (raw ?? "").trim() || DEFAULT_FOLDER;
  if (!t.startsWith("/ccos")) return DEFAULT_FOLDER;
  if (t.includes("..") || t.includes("\\")) return DEFAULT_FOLDER;
  return t.slice(0, 240);
}

function safeFileName(name: string): string {
  const base = name.trim() || "upload";
  return base.replace(/[/\\]/g, "_").slice(0, 200);
}

export async function POST(request: Request) {
  const gated = await requireSession();
  if (!gated.ok) return gated.response;

  if (!isImageKitConfigured()) {
    return NextResponse.json(
      { error: "File upload is not configured (ImageKit)." },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 10MB)" },
      { status: 400 },
    );
  }

  const folder = sanitizeFolder(
    typeof formData.get("folder") === "string"
      ? (formData.get("folder") as string)
      : null,
  );

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = safeFileName(file.name || "upload");
  const mime = file.type || "application/octet-stream";

  try {
    const ik = getImageKit();
    const result = await ik.upload({
      file: buffer,
      fileName,
      folder,
      useUniqueFileName: true,
    });

    return NextResponse.json({
      url: result.url,
      fileId: result.fileId,
      name: result.name ?? fileName,
      mime,
      size: result.size ?? buffer.length,
    });
  } catch (e) {
    console.error(e);
    const message =
      e instanceof Error ? e.message : "Upload to storage failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

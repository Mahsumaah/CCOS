export type UploadResult = {
  url: string;
  fileId: string;
  name: string;
  mime: string;
  size: number;
};

/**
 * Upload a file to ImageKit via `/api/upload`.
 * @param folder e.g. `/ccos/attachments`, `/ccos/minutes`, `/ccos/delegations`, `/ccos/signatures`, `/ccos/logos` (tenant branding, Phase 6)
 */
export async function uploadFile(
  file: File | Blob,
  folder?: string,
  fileNameForBlob?: string,
): Promise<UploadResult> {
  const formData = new FormData();
  const name =
    file instanceof File
      ? file.name
      : (fileNameForBlob ?? `upload-${Date.now()}.bin`);
  formData.append("file", file, name);
  if (folder) formData.append("folder", folder);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  const body = (await res.json().catch(() => ({}))) as UploadResult & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? "Upload failed");
  }
  if (!body.url || !body.fileId) {
    throw new Error("Upload failed: invalid response");
  }
  return {
    url: body.url,
    fileId: body.fileId,
    name: body.name,
    mime: body.mime,
    size: body.size,
  };
}

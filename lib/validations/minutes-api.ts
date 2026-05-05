import { z } from "zod";

export const patchMinutesBodySchema = z
  .object({
    contentHtml: z.string().optional(),
    finalize: z.boolean().optional(),
  })
  .refine(
    (o) => o.contentHtml !== undefined || o.finalize === true,
    { message: "emptyPatch" },
  );

export type PatchMinutesBody = z.infer<typeof patchMinutesBodySchema>;

/** POST /api/meetings/[id]/minutes/sign — send explicit nulls to clear the other field. */
export const postMinutesSignBodySchema = z
  .object({
    typedName: z.union([z.string().max(500), z.null()]),
    signatureImageUrl: z.union([
      z
        .string()
        .max(2048)
        .refine((s) => /^https:\/\//i.test(s), {
          message: "invalidSignatureImageUrl",
        }),
      z.null(),
    ]),
  })
  .refine(
    (o) =>
      (o.typedName != null && o.typedName.trim().length > 0) ||
      (o.signatureImageUrl != null && o.signatureImageUrl.length > 0),
    { message: "signatureRequired" },
  );

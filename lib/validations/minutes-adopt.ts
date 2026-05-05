import { z } from "zod";

const adoptedHttpsUrl = z
  .string()
  .url()
  .max(2048)
  .refine((s) => /^https:\/\//i.test(s), { message: "invalidAdoptedDocumentUrl" });

export const postMinutesAdoptBodySchema = z.object({
  url: adoptedHttpsUrl,
  name: z.string().min(1).max(500),
  mime: z.string().min(1).max(200),
  size: z.number().int().nonnegative(),
});

export type PostMinutesAdoptBody = z.infer<typeof postMinutesAdoptBodySchema>;

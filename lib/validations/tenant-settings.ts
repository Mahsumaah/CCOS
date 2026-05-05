import { z } from "zod";

export const patchTenantBodySchema = z.object({
  name: z.string().trim().min(2).optional(),
  logo: z.union([z.string().trim().min(1).max(2048), z.literal(""), z.null()]).optional(),
  defaultLocale: z.enum(["ar", "en"]).optional(),
});

export type PatchTenantBody = z.infer<typeof patchTenantBodySchema>;

import { DelegationScope } from "@prisma/client";
import { z } from "zod";

export const createDelegationFormSchema = z.object({
  fromUserId: z.string().cuid(),
  toUserId: z.string().cuid(),
  scope: z.nativeEnum(DelegationScope),
});

export type CreateDelegationFormInput = z.infer<typeof createDelegationFormSchema>;

/** POST /api/meetings/[id]/delegations — JSON; optional auth doc already on ImageKit. */
export const postDelegationCreateJsonBodySchema = createDelegationFormSchema
  .extend({
    authDocUrl: z
      .string()
      .url()
      .max(2048)
      .refine((s) => /^https:\/\//i.test(s), { message: "invalidAuthDocUrl" })
      .optional(),
    authDocName: z.string().min(1).max(500).optional(),
    authDocMime: z.string().max(200).optional(),
    authDocSize: z.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    const hasUrl = Boolean(data.authDocUrl?.trim());
    const hasName = Boolean(data.authDocName?.trim());
    if (hasUrl !== hasName) {
      ctx.addIssue({
        code: "custom",
        message: "authDocPairRequired",
        path: hasUrl ? ["authDocName"] : ["authDocUrl"],
      });
    }
  });

export type PostDelegationCreateJsonBody = z.infer<
  typeof postDelegationCreateJsonBodySchema
>;

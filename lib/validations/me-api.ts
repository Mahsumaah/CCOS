import { z } from "zod";

export const patchMeBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).max(72).optional(),
  })
  .superRefine((val, ctx) => {
    const nameUpdate = val.name !== undefined;
    const pwUpdate =
      (val.currentPassword !== undefined && val.currentPassword !== "") ||
      (val.newPassword !== undefined && val.newPassword !== "");

    if (nameUpdate && pwUpdate) {
      ctx.addIssue({
        code: "custom",
        message: "profileOrPasswordNotBoth",
        path: ["name"],
      });
      return;
    }

    if (!nameUpdate && !pwUpdate) {
      ctx.addIssue({
        code: "custom",
        message: "emptyBody",
      });
      return;
    }

    if (pwUpdate) {
      if (!val.currentPassword?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "currentPasswordRequired",
          path: ["currentPassword"],
        });
      }
      if (!val.newPassword?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "newPasswordRequired",
          path: ["newPassword"],
        });
      }
    }
  });

export type PatchMeBody = z.infer<typeof patchMeBodySchema>;

import { PositionCategory } from "@prisma/client";
import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "invalidCode")
  .transform((s) => s.toUpperCase());

function optionalLabelEn() {
  return z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const t = v.trim();
      return t === "" ? null : t;
    })
    .refine((v) => v === undefined || v === null || v.length <= 500, {
      message: "labelEnMax",
    });
}

export const createPositionBodySchema = z.object({
  code: codeSchema,
  labelAr: z.string().trim().min(1).max(500),
  labelEn: optionalLabelEn(),
  level: z.coerce.number().int().default(0),
  category: z.nativeEnum(PositionCategory),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type CreatePositionBody = z.infer<typeof createPositionBodySchema>;

export const patchPositionBodySchema = z
  .object({
    labelAr: z.string().trim().min(1).max(500).optional(),
    labelEn: z
      .string()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => {
        if (v === undefined) return undefined;
        if (v === null) return null;
        const t = v.trim();
        return t === "" ? null : t;
      }),
    level: z.coerce.number().int().optional(),
    category: z.nativeEnum(PositionCategory).optional(),
    sortOrder: z.coerce.number().int().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "emptyPatch" });

export type PatchPositionBody = z.infer<typeof patchPositionBodySchema>;

import { DecisionStatus } from "@prisma/client";
import { z } from "zod";

function optionalDateInput() {
  return z
    .union([z.string(), z.null(), z.literal("")])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : d;
    });
}

export const createDecisionBodySchema = z.object({
  textAr: z.string().trim().min(1, "required").max(10_000),
  textEn: z.string().trim().max(10_000).optional().nullable(),
  agendaItemId: z.string().cuid().optional().nullable(),
  ownerId: z.string().cuid().optional().nullable(),
  dueDate: optionalDateInput(),
});

export type CreateDecisionBody = z.infer<typeof createDecisionBodySchema>;

export const patchDecisionBodySchema = z.object({
  textAr: z.string().trim().min(1).max(10_000).optional(),
  textEn: z.string().trim().max(10_000).optional().nullable(),
  status: z.nativeEnum(DecisionStatus).optional(),
  agendaItemId: z.string().cuid().optional().nullable(),
  ownerId: z.string().cuid().optional().nullable(),
  dueDate: optionalDateInput(),
});

export type PatchDecisionBody = z.infer<typeof patchDecisionBodySchema>;

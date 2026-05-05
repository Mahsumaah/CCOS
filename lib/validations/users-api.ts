import { BoardRole } from "@prisma/client";
import { z } from "zod";

const emailSchema = z.string().trim().email().max(320);
const nameSchema = z.string().trim().min(1).max(200);

export const postInviteUserBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  role: z.nativeEnum(BoardRole),
  positionCode: z.string().max(64).nullable().optional(),
});

export type PostInviteUserBody = z.infer<typeof postInviteUserBodySchema>;

const permField = z.boolean().optional();

export const patchUserBodySchema = z
  .object({
    name: nameSchema.optional(),
    role: z.nativeEnum(BoardRole).optional(),
    positionCode: z.union([z.string().max(64), z.null()]).optional(),
    isActive: z.boolean().optional(),
    permCreateMeetings: permField,
    permEditMeetings: permField,
    permManageMeetings: permField,
    permCreateVotes: permField,
    permCastVotes: permField,
    permCreateDecisions: permField,
    permEditDecisions: permField,
    permFinalizeMinutes: permField,
    permManagePositions: permField,
    permManageUsers: permField,
  })
  .refine(
    (o) => Object.keys(o).length > 0,
    { message: "emptyPatch" },
  );

export type PatchUserBody = z.infer<typeof patchUserBodySchema>;

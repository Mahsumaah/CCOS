import { z } from "zod";

export const createVoteBodySchema = z.object({
  question: z.string().trim().min(1, "required").max(2000),
  agendaItemId: z.string().cuid().optional().nullable(),
});

export type CreateVoteBody = z.infer<typeof createVoteBodySchema>;

export const patchVoteBodySchema = z.object({
  isOpen: z.boolean(),
  /** Meeting managers may bypass quorum when closing a vote. */
  forceClose: z.boolean().optional(),
});

export type PatchVoteBody = z.infer<typeof patchVoteBodySchema>;

export const castBallotBodySchema = z
  .object({
    choice: z.enum(["APPROVE", "REJECT", "ABSTAIN"]),
    /** Delegator (ballot.userId); session user stored as castById on the ballot. */
    forUserId: z.string().cuid().optional(),
    /** Same as forUserId (API alias). */
    userId: z.string().cuid().optional(),
  })
  .transform(({ choice, forUserId, userId }) => ({
    choice,
    forUserId: forUserId ?? userId,
  }));

export type CastBallotBody = z.infer<typeof castBallotBodySchema>;

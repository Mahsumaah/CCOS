import { z } from "zod";

export const setBoardPasswordBodySchema = z.object({
  /** Trim: invite links sometimes copy with leading/trailing spaces. */
  token: z.string().trim().min(1).max(512),
  password: z.string().min(8).max(72),
});

export type SetBoardPasswordBody = z.infer<typeof setBoardPasswordBodySchema>;

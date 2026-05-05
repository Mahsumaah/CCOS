import { z } from "zod";

export const setBoardPasswordBodySchema = z.object({
  token: z.string().min(1).max(512),
  password: z.string().min(8).max(72),
});

export type SetBoardPasswordBody = z.infer<typeof setBoardPasswordBodySchema>;

import type { VoteChoice } from "@prisma/client";

export type VoteOutcome =
  | { kind: "NONE" }
  | { kind: "TIE" }
  | { kind: "WIN"; choice: VoteChoice };

export function computeVoteOutcome(tallies: {
  approve: number;
  reject: number;
  abstain: number;
}): VoteOutcome {
  const { approve, reject, abstain } = tallies;
  const total = approve + reject + abstain;
  if (total === 0) return { kind: "NONE" };

  const max = Math.max(approve, reject, abstain);
  const top: VoteChoice[] = [];
  if (approve === max) top.push("APPROVE");
  if (reject === max) top.push("REJECT");
  if (abstain === max) top.push("ABSTAIN");
  if (top.length !== 1) return { kind: "TIE" };
  return { kind: "WIN", choice: top[0]! };
}

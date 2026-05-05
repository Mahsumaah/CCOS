import type { DecisionStatus, InvitationStatus } from "@prisma/client";

export type MinutesVoteResult = "APPROVED" | "REJECTED" | "TIE";

export type MinutesData = {
  meeting: {
    title: string;
    type: string;
    typeLabel: string;
    scheduledAt: Date;
    startedAt: Date | null;
    endedAt: Date | null;
    durationMin: number;
    location: string | null;
    objectives: string | null;
  };
  tenant: { name: string; logo: string | null };
  attendees: {
    name: string;
    role: string;
    roleLabel: string;
    rsvpStatus: InvitationStatus;
    checkedInAt: Date | null;
  }[];
  absentees: { name: string; role: string; roleLabel: string }[];
  agenda: {
    order: number;
    titleAr: string;
    titleEn: string | null;
    notes: string | null;
    decisions: {
      textAr: string;
      textEn: string | null;
      status: DecisionStatus;
      createdBy: string;
    }[];
    votes: {
      question: string;
      isOpen: boolean;
      tallies: { approve: number; reject: number; abstain: number; total: number };
      result: MinutesVoteResult;
    }[];
  }[];
  allDecisions: {
    number: number;
    textAr: string;
    textEn: string | null;
    status: DecisionStatus;
    owner: string | null;
    dueDate: Date | null;
  }[];
  allVotes: {
    question: string;
    result: MinutesVoteResult;
    tallies: { approve: number; reject: number; abstain: number; total: number };
  }[];
  signatures: {
    userName: string;
    role: string;
    roleLabel: string;
    signedAt: Date;
    typedName: string | null;
    signatureImageUrl: string | null;
  }[];
};

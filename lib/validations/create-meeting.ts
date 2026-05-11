import { MeetingSchedulingMode, MeetingType } from "@prisma/client";
import { z } from "zod";

/** Draft row: allows empty title while the user is editing or adding rows. */
export const agendaItemDraftSchema = z.object({
  titleAr: z.string(),
  titleEn: z.string().optional(),
  notes: z.string().optional(),
});

/** Strict row for API / server validation. */
export const agendaItemFormSchema = z.object({
  titleAr: z.string().trim().min(1),
  titleEn: z.string().optional(),
  notes: z.string().optional(),
});

export const meetingFormSchema = z
  .object({
    title: z.string().min(1, { message: "validationTitleRequired" }),
    type: z.nativeEnum(MeetingType),
    customMeetingType: z.string().optional(),
    objectives: z.string().optional(),
    schedulingMode: z.nativeEnum(MeetingSchedulingMode),
    scheduledAt: z.date(),
    durationMin: z
      .number()
      .min(15, { message: "validationDurationMin" })
      .max(480, { message: "validationDurationMax" }),
    /** Physical venue only; CCOS Live handles video (no external URLs). */
    location: z.string().optional(),
    agenda: z
      .array(agendaItemDraftSchema)
      .min(1, { message: "validationAgendaMinRows" }),
    inviteeIds: z.array(z.string()),
    guestEmails: z
      .array(
        z.string().email({
          message: "validationGuestEmailItem",
        }),
      )
      .optional()
      .default([]),
  })
  .superRefine((data, ctx) => {
    const filled = data.agenda.filter((a) => a.titleAr.trim().length > 0);
    if (filled.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validationAgendaAtLeastOneTitleAr",
        path: ["agenda", 0, "titleAr"],
      });
    }

    if (
      (data.type === MeetingType.STRATEGIC ||
        data.type === MeetingType.EMERGENCY) &&
      (!data.customMeetingType || !data.customMeetingType.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validationCustomMeetingTypeRequired",
        path: ["customMeetingType"],
      });
    }

    const loc = data.location?.trim();
    if (loc && /^https?:\/\//i.test(loc)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validationVenueNoUrls",
        path: ["location"],
      });
    }
  });

export type MeetingFormValues = z.infer<typeof meetingFormSchema>;

/** POST /api/meetings JSON body */
export const meetingCreateJsonSchema = z
  .object({
    title: z.string().min(1),
    type: z.nativeEnum(MeetingType),
    customMeetingType: z.string().optional(),
    objectives: z.string().optional(),
    schedulingMode: z.nativeEnum(MeetingSchedulingMode),
    scheduledAt: z.coerce.date(),
    durationMin: z.coerce.number().min(15).max(480),
    location: z.string().optional(),
    agenda: z
      .array(agendaItemFormSchema)
      .min(1, { message: "At least one agenda item required" }),
    inviteeIds: z.array(z.string()),
    guestEmails: z.array(z.string().email()).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (
      (data.type === MeetingType.STRATEGIC ||
        data.type === MeetingType.EMERGENCY) &&
      (!data.customMeetingType || !String(data.customMeetingType).trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validationCustomMeetingTypeRequired",
        path: ["customMeetingType"],
      });
    }

    const loc = data.location?.trim();
    if (loc && /^https?:\/\//i.test(loc)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validationVenueNoUrls",
        path: ["location"],
      });
    }
  });

export type MeetingCreateBody = z.infer<typeof meetingCreateJsonSchema>;

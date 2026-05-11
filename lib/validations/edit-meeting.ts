import { MeetingType } from "@prisma/client";
import { z } from "zod";

/** Metadata PATCH for meeting edit (no agenda / invitees). */
export const editMeetingMetadataSchema = z
  .object({
    title: z.string().min(1, { message: "validationTitleRequired" }),
    type: z.nativeEnum(MeetingType),
    customMeetingType: z.string().optional().nullable(),
    objectives: z.string().optional().nullable(),
    scheduledAt: z.coerce.date(),
    durationMin: z.coerce
      .number()
      .min(15, { message: "validationDurationMin" })
      .max(480, { message: "validationDurationMax" }),
    location: z.string().optional().nullable(),
  })
  .strict()
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

export type EditMeetingMetadataInput = z.infer<typeof editMeetingMetadataSchema>;

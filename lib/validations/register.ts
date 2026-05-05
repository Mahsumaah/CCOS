import { z } from "zod";

/** POST /api/auth/register — no confirmPassword. */
export const registerApiBodySchema = z.object({
  organizationName: z.string().trim().min(2),
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
  locale: z.enum(["ar", "en"]).optional().default("ar"),
});

export type RegisterApiBody = z.infer<typeof registerApiBodySchema>;

export function buildRegisterFormSchema(t: (key: string) => string) {
  return z
    .object({
      organizationName: z
        .string()
        .trim()
        .min(2, { message: t("registerValidationOrganizationMin") }),
      name: z.string().trim().min(2, { message: t("registerValidationNameMin") }),
      email: z.string().trim().email({ message: t("registerValidationEmail") }),
      password: z
        .string()
        .min(8, { message: t("registerValidationPasswordMin") }),
      confirmPassword: z.string().min(1, {
        message: t("registerValidationConfirmRequired"),
      }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("registerPasswordMismatch"),
      path: ["confirmPassword"],
    });
}

export type RegisterFormSchema = ReturnType<typeof buildRegisterFormSchema>;
export type RegisterFormValues = z.infer<RegisterFormSchema>;

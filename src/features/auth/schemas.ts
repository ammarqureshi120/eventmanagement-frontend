import { z } from "zod"
/**
 * Sign-in form checks (UX only; the server stays the authority from Story 1.4).
 * Messages are the agreed copy (spec 1.2 Decisions).
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .pipe(z.email("Enter an email like name@company.com.")),
  password: z.string().min(1, "Enter your password."),
})

export type LoginFormInput = z.input<typeof loginSchema>
export type LoginFormValues = z.output<typeof loginSchema>

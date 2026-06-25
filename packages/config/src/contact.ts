import { z } from 'zod';

/**
 * Contact form contracts. All fields are plain text (rendered escaped + sent as
 * a text email). `company` is a honeypot — real users leave it empty.
 */
export const contactSubmissionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000),
  recaptchaToken: z.string().optional(),
  company: z.string().optional(),
});
export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;

export const adminContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  subject: z.string().nullable(),
  message: z.string(),
  handledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type AdminContact = z.infer<typeof adminContactSchema>;

export const adminContactListSchema = z.array(adminContactSchema);
export type AdminContactList = z.infer<typeof adminContactListSchema>;

export const updateContactSchema = z.object({ handled: z.boolean() });
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

/** Resolve the contact recipient: profile email → env → MAIL_FROM (first non-blank). */
export function resolveContactRecipient(
  profileEmail: string,
  envEmail: string | undefined,
  fromEmail: string,
): string {
  const candidates = [profileEmail, envEmail ?? '', fromEmail];
  for (const c of candidates) {
    if (c.trim() !== '') return c.trim();
  }
  return fromEmail;
}

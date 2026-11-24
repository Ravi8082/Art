import { z } from 'zod'

export const leadAttributionSchema = z.object({
  source: z.enum(['direct', 'instagram', 'facebook', 'google', 'whatsapp', 'newsletter', 'referral', 'other']).default('direct'),
  medium: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,39}$/i).nullable().default(null),
  campaign: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/i).nullable().default(null),
  marketingEmailConsent: z.boolean().default(false),
  marketingWhatsAppConsent: z.boolean().default(false),
}).strict()

export function hasValidWhatsAppContact(phone: string, marketingWhatsAppConsent: boolean) {
  return !marketingWhatsAppConsent || /^\d{10,15}$/.test(phone.replace(/\D/g, ''))
}

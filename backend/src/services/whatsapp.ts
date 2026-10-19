const graphVersion = process.env.WHATSAPP_API_VERSION ?? 'v21.0'

export function normalizeWhatsAppNumber(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length === 10) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`
  return digits.length >= 11 && digits.length <= 15 ? digits : null
}

export function whatsappConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

// Uses an approved template when WHATSAPP_TEMPLATE_NAME is set (needed outside the 24h window),
// otherwise sends a plain text message.
export async function sendWhatsApp(phone: string | null | undefined, text: string) {
  const to = normalizeWhatsAppNumber(phone)
  if (!to) return { sent: false, reason: 'No valid phone number' }
  if (!whatsappConfigured()) return { sent: false, reason: 'WhatsApp not configured' }
  const template = process.env.WHATSAPP_TEMPLATE_NAME
  const body = template
    ? {
        messaging_product: 'whatsapp', to, type: 'template',
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? 'en' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: text.replace(/\s*\n+\s*/g, ' ').slice(0, 1000) }] }],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0, 4000), preview_url: true } }
  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      console.error('WhatsApp message failed', { status: response.status })
      return { sent: false, reason: `WhatsApp API ${response.status}` }
    }
    return { sent: true }
  } catch (error) {
    console.error('WhatsApp message failed', { reason: error instanceof Error ? error.message : 'unknown' })
    return { sent: false, reason: 'WhatsApp request failed' }
  }
}

// Sends one message to every consenting visitor phone, a few at a time, without blocking the caller.
export async function broadcastWhatsAppToConsentedVisitors(text: string) {
  if (!whatsappConfigured()) return { queued: 0 }
  const { pool } = await import('../db/pool.js')
  const [rows] = await pool.query<any[]>(
    `SELECT DISTINCT phone FROM visitor_profiles WHERE marketing_consent=1 AND phone<>''`)
  const phones = [...new Set(rows.map((row) => normalizeWhatsAppNumber(row.phone)).filter(Boolean) as string[])]
  void (async () => {
    for (let i = 0; i < phones.length; i += 5) {
      await Promise.all(phones.slice(i, i + 5).map((phone) => sendWhatsApp(phone, text)))
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  })()
  return { queued: phones.length }
}

// Looks up a phone number for an email from visitor profiles or exhibitor applications.
export async function sendWhatsAppToEmail(email: string, text: string, options: { requireConsent?: boolean } = {}) {
  if (!whatsappConfigured()) return { sent: false, reason: 'WhatsApp not configured' }
  const { pool } = await import('../db/pool.js')
  const address = email.toLowerCase()
  const consent = options.requireConsent ? 'AND marketing_consent=1' : ''
  const [rows] = await pool.query<any[]>(
    `SELECT phone FROM (
       SELECT phone, created_at ts FROM visitor_profiles WHERE email=? AND phone<>'' ${consent}
       ${options.requireConsent ? '' : `UNION ALL
       SELECT a.phone, a.created_at ts FROM exhibition_applications a JOIN users u ON u.id=a.user_id WHERE u.email=? AND a.phone<>''`}
     ) p ORDER BY ts DESC LIMIT 1`, options.requireConsent ? [address] : [address, address])
  return sendWhatsApp(rows[0]?.phone, text)
}

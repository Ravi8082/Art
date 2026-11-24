export type PublicPassRecord = {
  eventTitle: string
  city: string | null
  venue: string | null
  startsAt: string | Date
  endsAt: string | Date
  revokedAt: string | Date | null
  registrationStatus: string
  paymentStatus: string
  checkedIn: boolean | number
  notStarted: boolean | number
  dayOver: boolean | number
}

export function publicPassView(pass: PublicPassRecord) {
  // SECURITY: The public QR URL is a bearer reference; return only event logistics and a minimal entry-validity verdict.
  const invalid = Boolean(pass.revokedAt)
    || pass.registrationStatus !== 'REGISTERED'
    || pass.paymentStatus === 'PENDING'
    || Boolean(pass.checkedIn)
    || Boolean(pass.dayOver)
    || Boolean(pass.notStarted)

  return {
    event: pass.eventTitle,
    city: pass.city,
    venue: pass.venue,
    startsAt: pass.startsAt,
    endsAt: pass.endsAt,
    status: invalid ? 'Not valid' : 'Valid',
  } as const
}

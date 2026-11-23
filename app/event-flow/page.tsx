import type { Metadata } from 'next'
import { PublicShell } from '@/components/public-shell'
import { EventFlowPage } from '@/components/event-flow-page'
import { getEventFlow, getInvitedGuests, getShell } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Exhibition Flow & Day-by-Day Schedule | The Haat of Art',
  description: 'Explore how every Haat of Art exhibition unfolds, from artist setup and grand inauguration to workshops, felicitation and closing.',
  alternates: { canonical: '/event-flow' },
}

export default async function EventFlowRoute() {
  const [{ shell }, content, guests] = await Promise.all([
    getShell(),
    getEventFlow(),
    getInvitedGuests('exhibitions'),
  ])
  return (
    <PublicShell {...shell}>
      {content
        ? <EventFlowPage content={content} guests={guests} />
        : <div className="event-flow-unavailable"><h1>Exhibition Flow</h1><p>The exhibition schedule is temporarily unavailable. Please try again shortly.</p></div>}
    </PublicShell>
  )
}

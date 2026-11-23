import '../booking.css'
import { PublicShell } from '@/components/public-shell'
import { BookingWizard } from '@/components/booking/booking-wizard'
import { getBookingUser, getExhibitionsForBooking } from '@/lib/booking-server'
import { apiBaseUrl as siteApiBase, getHomepageMedia, getShell } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Book Your Stall at an Art Fest | The Haat of Art',
  description: 'Apply for a stall at The Haat of Art exhibitions — choose your exhibition, pick a stall from the live floor plan and pay securely.',
  alternates: { canonical: '/book-your-stall' },
}

export default async function BookYourStallPage({ searchParams }: {
  searchParams: Promise<{ stall?: string | string[] }>
}) {
  const params = await searchParams
  const requestedStall = Array.isArray(params.stall) ? params.stall[0] : params.stall
  const initialStall = requestedStall && ['compact', 'standard', 'group', 'gallery'].includes(requestedStall) ? requestedStall : ''
  const [exhibitions, user, shell, homepageMedia] = await Promise.all([
    getExhibitionsForBooking(), getBookingUser(), getShell(), getHomepageMedia(),
  ])
  const heroMedia = ['hero', 'hero2', 'hero3'].map((key) => homepageMedia?.[key]).find(Boolean)
  const heroImage = heroMedia
    ? { src: heroMedia.url.startsWith('http') ? heroMedia.url : `${siteApiBase}${heroMedia.url}`, alt: heroMedia.altText || 'Visitors exploring artwork at The Haat of Art' }
    : { src: '/media/hero-exhibition.jpg', alt: 'Visitors exploring artwork at The Haat of Art' }

  return (
    <PublicShell {...shell.shell}>
      <BookingWizard exhibitions={exhibitions} initialUser={user} heroImage={heroImage} initialStall={initialStall} />
    </PublicShell>
  )
}

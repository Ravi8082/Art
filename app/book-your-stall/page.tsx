import '../booking.css'
import { PublicShell } from '@/components/public-shell'
import { BookingWizard } from '@/components/booking/booking-wizard'
import { getBookingUser, getExhibitionsForBooking, getStallTypesForBooking } from '@/lib/booking-server'
import { apiBaseUrl as siteApiBase, getHomepageMedia, getShell } from '@/lib/api'
import { demoHero } from '@/lib/demo-home-content'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Book Your Stall · The Haat of Art',
  description: 'Apply for a stall at The Haat of Art exhibitions — choose your exhibition, pick a stall from the live floor plan and pay securely.',
}

export default async function BookYourStallPage() {
  const [exhibitions, stallTypes, user, shell, homepageMedia] = await Promise.all([
    getExhibitionsForBooking(), getStallTypesForBooking(), getBookingUser(), getShell(), getHomepageMedia(),
  ])
  const heroMedia = ['hero', 'hero2', 'hero3'].map((key) => homepageMedia?.[key]).find(Boolean)
  const heroImage = heroMedia
    ? { src: `${siteApiBase}${heroMedia.url}`, alt: heroMedia.altText }
    : demoHero.slides[0]

  return (
    <PublicShell {...shell.shell}>
      <BookingWizard exhibitions={exhibitions} stallTypes={stallTypes} initialUser={user} heroImage={heroImage} />
    </PublicShell>
  )
}

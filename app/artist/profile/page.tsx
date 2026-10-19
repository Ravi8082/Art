import { redirect } from 'next/navigation'
import { PublicShell } from '@/components/public-shell'
import { ArtistProfileEditor } from '@/components/artist/artist-profile-editor'
import { getBookingUser, getMyArtistProfile } from '@/lib/booking-server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Profile · The Haat of Art', robots: { index: false } }

export default async function Page() {
  const user = await getBookingUser()
  if (!user) redirect('/login')
  const data = await getMyArtistProfile()
  return <PublicShell><ArtistProfileEditor initial={data} fallbackName={user.fullName} email={user.email} /></PublicShell>
}
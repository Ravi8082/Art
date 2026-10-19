import { redirect } from 'next/navigation'
import { AddArtwork } from '@/components/artist/artist-pages'
import { getBookingUser } from '@/lib/booking-server'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Add New Artwork · The Haat of Art', robots: { index: false } }

export default async function Page() {
  const user = await getBookingUser()
  if (!user) redirect('/login')
  return <AddArtwork userName={user.fullName} />
}
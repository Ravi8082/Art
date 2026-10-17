import '../../booking.css'
import { PublicShell } from '@/components/public-shell'
import { MyBookings } from '@/components/booking/my-bookings'
import { getBookingUser } from '@/lib/booking-server'
import { getShell } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'My Applications & Bookings · The Haat of Art',
  description: 'Track your stall applications, approvals, payments and receipts for The Haat of Art exhibitions.',
}

export default async function MyBookingsPage() {
  const [user, shell] = await Promise.all([getBookingUser(), getShell()])
  return (
    <PublicShell {...shell.shell}>
      <MyBookings initialUser={user} />
    </PublicShell>
  )
}

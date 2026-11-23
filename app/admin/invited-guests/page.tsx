import { InvitedGuestsManager } from '@/components/invited-guests-manager'
import { DashboardRouteGuard } from '@/components/dashboard-route-guard'

export const metadata = { title: 'Invited Guests & Luminaries · The Haat of Art' }

export default function InvitedGuestsAdminPage() {
  return <DashboardRouteGuard><InvitedGuestsManager /></DashboardRouteGuard>
}

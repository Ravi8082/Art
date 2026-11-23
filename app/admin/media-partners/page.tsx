import { DashboardRouteGuard } from '@/components/dashboard-route-guard'
import { MediaPartnersManager } from '@/components/media-partners-manager'

export const metadata = { title: 'Media, Press & Outdoor Alliances · The Haat of Art' }

export default function MediaPartnersAdminPage() {
  return <DashboardRouteGuard><MediaPartnersManager /></DashboardRouteGuard>
}

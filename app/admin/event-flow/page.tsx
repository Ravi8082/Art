import { DashboardRouteGuard } from '@/components/dashboard-route-guard'
import { EventFlowManager } from '@/components/event-flow-manager'

export const metadata = { title: 'Manage Event Flow · The Haat of Art' }

export default function EventFlowAdminPage() {
  return <DashboardRouteGuard><EventFlowManager /></DashboardRouteGuard>
}

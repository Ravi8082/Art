import type { ReactNode } from 'react'
import { DashboardRouteGuard } from '@/components/dashboard-route-guard'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardRouteGuard>{children}</DashboardRouteGuard>
}

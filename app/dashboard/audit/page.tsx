import { DashboardInsights } from '@/components/dashboard-insights'

export const metadata = { title: 'Audit Log · The Haat of Art' }

export default function DashboardAuditPage() {
  return <DashboardInsights mode="audit" />
}

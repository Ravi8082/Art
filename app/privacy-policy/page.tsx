import type { Metadata } from 'next'
import { LegalNoticePage } from '@/components/legal-notice-page'

export const revalidate = 30
export const metadata: Metadata = { title: 'Privacy Policy', robots: { index: false, follow: true } }

export default function PrivacyPolicyPage() {
  return <LegalNoticePage kind="privacy" />
}

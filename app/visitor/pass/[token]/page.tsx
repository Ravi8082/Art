import type { Metadata } from 'next'
import { VisitorPublicPass } from '@/components/visitor-public-pass'

export const metadata: Metadata = {
  title: 'Visitor Pass · The Haat of Art',
  robots: { index: false, follow: false },
}

export default async function VisitorPassPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <VisitorPublicPass token={token} />
}

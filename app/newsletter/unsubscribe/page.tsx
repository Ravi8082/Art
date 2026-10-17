import { NewsletterUnsubscribe } from '@/components/newsletter-unsubscribe'

export const metadata = { title: 'Newsletter preferences · The Haat of Art' }

export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>
}) {
  const { token } = await searchParams
  return <NewsletterUnsubscribe token={typeof token === 'string' ? token : ''} />
}

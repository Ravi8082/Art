import { redirect } from 'next/navigation'

export const metadata = { title: 'Artist Dashboard · The Haat of Art' }

export default function Page() {
  redirect('/dashboard')
}

import { PublicShell } from '@/components/public-shell'
import { ArtistProfile, DemoNote } from '@/components/artist/artist-pages'

export const metadata = { title: 'Priya Sharma · Artist · The Haat of Art' }

export default function Page() {
  return <PublicShell><ArtistProfile /><DemoNote /></PublicShell>
}

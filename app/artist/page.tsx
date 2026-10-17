import { PublicShell } from '@/components/public-shell'
import { ArtistHero, DemoNote } from '@/components/artist/artist-pages'

export const metadata = { title: 'Join as an Artist · The Haat of Art' }

export default function Page() {
  return <PublicShell><ArtistHero /><DemoNote /></PublicShell>
}

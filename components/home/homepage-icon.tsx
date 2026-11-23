import { Accessibility, Archive, Brush, CalendarDays, Image as ImageIcon, Landmark, Palette, Users } from 'lucide-react'
import type { HomepageIcon } from '@/lib/homepage-content'

const icons = {
  calendar: CalendarDays,
  users: Users,
  accessibility: Accessibility,
  palette: Palette,
  image: ImageIcon,
  landmark: Landmark,
  brush: Brush,
  archive: Archive,
} satisfies Record<HomepageIcon, typeof CalendarDays>

export function HomepageIconView({ name, size = 20 }: { name: HomepageIcon; size?: number }) {
  const Icon = icons[name]
  return <Icon size={size} aria-hidden="true" />
}

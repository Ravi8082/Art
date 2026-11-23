import { pool } from '../db/pool.js'

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

export type HomepageHeroSlide = {
  id: string
  imageUrl: string
  altText: string
  caption: string
  sortOrder: number
  isActive: boolean
}

export type HomepageHeroVideo = {
  url: string
  posterUrl: string
  enabled: boolean
  autoplay: boolean
  loop: boolean
}

export type HomepageHeroMedia = {
  slides: HomepageHeroSlide[]
  slidesManaged: boolean
  video: HomepageHeroVideo
}

export async function getHomepageHeroMedia(includeInactive = false): Promise<HomepageHeroMedia> {
  const activeFilter = includeInactive ? '' : 'WHERE is_active=1'
  const [slides] = await pool.query<any[]>(`
    SELECT id, image_url imageUrl, alt_text altText, caption, sort_order sortOrder, is_active isActive
    FROM homepage_hero_slides
    ${activeFilter}
    ORDER BY sort_order, created_at, id
  `)
  const [settings] = await pool.query<any[]>(`
    SELECT hero_video_url url, hero_video_poster_url posterUrl,
      hero_video_enabled enabled, hero_video_autoplay autoplay, hero_video_loop videoLoop,
      hero_slides_managed slidesManaged
    FROM homepage_hero_video_settings
    WHERE id=1
  `)
  const video = settings[0]

  return {
    slides: slides.map((slide) => ({
      ...slide,
      id: String(slide.id),
      imageUrl: String(slide.imageUrl),
      altText: String(slide.altText ?? ''),
      caption: String(slide.caption ?? ''),
      sortOrder: Number(slide.sortOrder),
      isActive: toBoolean(slide.isActive),
    })),
    slidesManaged: toBoolean(video?.slidesManaged ?? false),
    video: {
      url: String(video?.url ?? ''),
      posterUrl: String(video?.posterUrl ?? ''),
      enabled: toBoolean(video?.enabled ?? false),
      autoplay: toBoolean(video?.autoplay ?? true),
      loop: toBoolean(video?.videoLoop ?? true),
    },
  }
}

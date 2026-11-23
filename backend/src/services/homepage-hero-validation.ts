import { z } from 'zod'

const isHomepageMediaUrl = (value: string) => {
  if (!value) return true
  if (/^\/api\/homepage\/(?:media\/[A-Za-z0-9]+|uploads\/[0-9a-f-]{36})$/i.test(value)) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

const homepageMediaUrl = z.string().trim().max(1000).refine(isHomepageMediaUrl, 'Use a valid HTTPS URL or a homepage media URL')
const homepageImageUrl = z.string().trim().min(1).max(1000).refine(isHomepageMediaUrl, 'Use a valid HTTPS URL or a homepage media URL')

export const homepageHeroInput = z.object({
  slides: z.array(z.object({
    id: z.string().uuid(),
    imageUrl: homepageImageUrl,
    altText: z.string().trim().max(255),
    caption: z.string().trim().max(500),
    isActive: z.boolean(),
  }).strict()).max(30),
  video: z.object({
    url: homepageMediaUrl,
    posterUrl: homepageMediaUrl,
    enabled: z.boolean(),
    autoplay: z.boolean(),
    loop: z.boolean(),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (new Set(value.slides.map((slide) => slide.id)).size !== value.slides.length) {
    context.addIssue({ code: 'custom', message: 'Hero slide IDs must be unique', path: ['slides'] })
  }
  if (value.video.enabled && !value.video.url) {
    context.addIssue({ code: 'custom', message: 'Add a hero video URL before enabling the video', path: ['video', 'url'] })
  }
})

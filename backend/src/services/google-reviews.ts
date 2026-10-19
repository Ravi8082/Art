export type GoogleReview = {
  id: string; guestId: null; guestName: null; authorName: string; authorRole: string
  message: string; rating: number; sortOrder: number; active: true
}

const ttlMs = Number(process.env.GOOGLE_REVIEWS_TTL_MINUTES ?? 360) * 60_000
let cache: { at: number; items: GoogleReview[] } | null = null
let inflight: Promise<GoogleReview[]> | null = null

export function googleReviewsConfigured() {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY && process.env.GOOGLE_PLACE_ID)
}

export function mapGoogleReviews(payload: any): GoogleReview[] {
  const reviews: any[] = Array.isArray(payload?.reviews) ? payload.reviews : []
  return reviews
    .map((review, index) => ({
      id: `google-${review.name ?? index}`,
      guestId: null,
      guestName: null,
      authorName: String(review.authorAttribution?.displayName ?? 'Google user').slice(0, 120),
      authorRole: 'Google review',
      message: String(review.text?.text ?? review.originalText?.text ?? '').trim().slice(0, 1200),
      rating: Math.max(1, Math.min(5, Math.round(Number(review.rating) || 5))),
      sortOrder: 1000 + index,
      active: true as const,
    }))
    .filter((review) => review.message && review.rating >= 4)
}

async function load() {
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(process.env.GOOGLE_PLACE_ID!)}`, {
    headers: { 'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY!, 'X-Goog-FieldMask': 'reviews' },
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw new Error(`Google Places ${response.status}`)
  return mapGoogleReviews(await response.json())
}

// Cached so homepage traffic never reaches Google; stale reviews are served if Google is down.
export async function getGoogleReviews(): Promise<GoogleReview[]> {
  if (!googleReviewsConfigured()) return []
  if (cache && Date.now() - cache.at < ttlMs) return cache.items
  inflight ??= load()
    .then((items) => { cache = { at: Date.now(), items }; return items })
    .catch((error) => {
      console.error('Google reviews fetch failed', { reason: error instanceof Error ? error.message : 'unknown' })
      cache = { at: Date.now() - ttlMs + 5 * 60_000, items: cache?.items ?? [] }
      return cache.items
    })
    .finally(() => { inflight = null })
  return inflight
}

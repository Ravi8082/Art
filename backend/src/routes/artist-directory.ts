import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { cachePublic } from '../middleware/cache.js'
import { pageMetadata, paginationRequested, publicPaginationSchema } from '../services/public-pagination.js'

export const artistDirectoryRouter = Router()
const publicCache = cachePublic(30)

const artistFields = `
  SELECT a.id, a.slug, a.display_name displayName, a.city, a.medium, a.specialty, a.bio,
         a.state, a.artist_statement artistStatement, a.practice_detail practiceDetail,
         a.active_since activeSince, a.core_themes coreThemes, a.exhibition_history exhibitionHistory,
         a.portrait_url portraitUrl, a.featured_artwork_url artworkUrl,
         a.roster_badge rosterBadge, a.is_spotlight isSpotlight, a.spotlight_quote spotlightQuote,
         (SELECT COUNT(*) FROM artist_directory_artworks work WHERE work.artist_id = a.id) artworkCount
  FROM artist_directory a`

function splitList(value: string | null) {
  return value ? value.split('|').map((item) => item.trim()).filter(Boolean) : []
}

function serializeArtist(artist: any) {
  return {
    ...artist,
    activeSince: Number(artist.activeSince),
    artworkCount: Number(artist.artworkCount),
    coreThemes: splitList(artist.coreThemes),
    exhibitionHistory: splitList(artist.exhibitionHistory),
    isSpotlight: Boolean(artist.isSpotlight),
  }
}

artistDirectoryRouter.get('/', publicCache, async (req, res, next) => {
  try {
    const isPaginated = paginationRequested(req.query)
    const pagination = publicPaginationSchema.safeParse(req.query)
    if (!pagination.success) return res.status(400).json({ error: 'Invalid artist list query' })
    const { page, pageSize } = pagination.data
    const pageClause = isPaginated ? 'LIMIT ? OFFSET ?' : 'LIMIT 200'
    const [artists] = await pool.query<any[]>(
      `${artistFields} ORDER BY a.sort_order, a.display_name ${pageClause}`,
      isPaginated ? [pageSize, (page - 1) * pageSize] : [],
    )
    const items = artists.map(serializeArtist)
    if (!isPaginated) return res.json(items)
    const [[count]] = await pool.query<any[]>('SELECT COUNT(*) total FROM artist_directory')
    res.json({
      artists: items,
      ...pageMetadata(page, pageSize, Number(count.total)),
    })
  } catch (error) { next(error) }
})

artistDirectoryRouter.get('/curated-gallery', publicCache, async (req, res, next) => {
  try {
    const isPaginated = paginationRequested(req.query)
    const pagination = publicPaginationSchema.safeParse(req.query)
    if (!pagination.success) return res.status(400).json({ error: 'Invalid gallery list query' })
    const { page, pageSize } = pagination.data
    const pageClause = isPaginated ? 'LIMIT ? OFFSET ?' : ''
    const [artworks] = await pool.query<any[]>(`
      SELECT work.id, work.title, artist.id artistId, artist.display_name artistName, artist.slug artistSlug,
             work.medium, work.dimensions, work.year_made year, work.city, work.price_amount price,
             work.status, work.description, work.image_url imageUrl
      FROM curated_gallery_artworks work
      JOIN artist_directory artist ON artist.id = work.artist_id
      ORDER BY work.sort_order, work.title
      ${pageClause}
    `, isPaginated ? [pageSize, (page - 1) * pageSize] : [])
    const items = artworks.map((work) => ({
      ...work,
      year: Number(work.year),
      price: Number(work.price),
    }))
    if (!isPaginated) return res.json(items)
    const [[count]] = await pool.query<any[]>('SELECT COUNT(*) total FROM curated_gallery_artworks')
    res.json({
      artworks: items,
      ...pageMetadata(page, pageSize, Number(count.total)),
    })
  } catch (error) { next(error) }
})

artistDirectoryRouter.get('/:slug', publicCache, async (req, res, next) => {
  try {
    const slug = req.params.slug
    if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return res.status(404).json({ error: 'Artist not found' })
    const [artists] = await pool.query<any[]>(`${artistFields} WHERE a.slug = ? LIMIT 1`, [slug])
    const artist = artists[0]
    if (!artist) return res.status(404).json({ error: 'Artist not found' })
    const [artworks] = await pool.query<any[]>(
      `SELECT id, title, medium, dimensions, year_made year, description, image_url imageUrl,
              status, price_amount priceAmount
       FROM artist_directory_artworks WHERE artist_id = ? ORDER BY sort_order, title LIMIT 8`,
      [artist.id])
    res.json({
      artist: serializeArtist(artist),
      artworks: artworks.map((work) => ({
        ...work,
        year: work.year === null ? null : Number(work.year),
        priceAmount: work.priceAmount === null ? null : Number(work.priceAmount),
      })),
    })
  } catch (error) { next(error) }
})

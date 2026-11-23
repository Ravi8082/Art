import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RowDataPacket } from 'mysql2/promise'
import { pool } from '../db/pool.js'

const mediaDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../../public/media/homepage-reference')
const mediaDefaults = [
  { key: 'hero', file: 'hero.png', alt: 'Visitors exploring The Haat of Art exhibition' },
  { key: 'exhibition1', file: 'exhibition1.png', alt: 'Art exhibition venue' },
  { key: 'exhibition2', file: 'exhibition2.png', alt: 'Art exhibition venue' },
  { key: 'exhibition3', file: 'exhibition3.png', alt: 'Art exhibition venue' },
  { key: 'glimpse', file: 'about.png', alt: 'Visitors exploring The Haat of Art gallery' },
  { key: 'mentor', file: 'mentor.png', alt: 'The Haat of Art mentor' },
  { key: 'highlight1', file: 'highlight1.png', alt: 'Art exhibitions' },
  { key: 'highlight2', file: 'highlight2.png', alt: 'Live painting' },
  { key: 'highlight3', file: 'highlight3.png', alt: 'Sculpture and three-dimensional art' },
  { key: 'highlight4', file: 'highlight4.png', alt: 'Visitor workshops' },
  { key: 'gallery1', file: 'gallery1.png', alt: 'Visitors exploring an art exhibition' },
  { key: 'gallery2', file: 'gallery2.png', alt: 'Artworks displayed at a gallery' },
  { key: 'gallery3', file: 'gallery3.png', alt: 'Sculptures displayed at an exhibition' },
  { key: 'gallery4', file: 'gallery4.png', alt: 'Visitors at an art exhibition' },
  { key: 'gallery5', file: 'gallery5.png', alt: 'Art exhibition gallery' },
  { key: 'testimonial1', file: 'testimonial1.png', alt: 'Artist testimonial portrait' },
  { key: 'testimonial2', file: 'testimonial2.png', alt: 'Visitor testimonial portrait' },
  { key: 'testimonial3', file: 'testimonial3.png', alt: 'Exhibitor testimonial portrait' },
] as const

const replaceableAltText = new Set([
  'Visitors in a bright art gallery',
  'A glimpse of The Haat of Art',
  'Visitors exploring a contemporary art exhibition',
  'A contemporary art gallery exhibition',
  'Art exhibition highlights',
  'Artist painting a live mural',
  'Sculpture and three-dimensional art',
  'Artisan artifacts on display',
  'Visitors exploring a contemporary art gallery',
  'Artist painting a mural',
  'Sculpture displayed at an art exhibition',
  'Colorful visual art at an exhibition',
  'Handmade artifacts at an exhibition',
  'Bengaluru International Exhibition Centre',
  'Pune International Exhibition Centre',
  'Pragati Maidan in New Delhi',
  'Visitors exploring The Haat of Art exhibition',
  'Visitors exploring The Haat of Art gallery',
  'The Haat of Art mentor',
  'Art exhibitions',
  'Live painting',
  'Visitor workshops',
  'Visitors exploring an art exhibition',
  'Artworks displayed at a gallery',
  'Sculptures displayed at an exhibition',
  'Visitors at an art exhibition',
  'Art exhibition gallery',
  'Artist testimonial portrait',
  'Visitor testimonial portrait',
  'Exhibitor testimonial portrait',
])

async function seedHomepageReferenceMedia() {
  for (const media of mediaDefaults) {
    const [existing] = await pool.query<(RowDataPacket & { altText: string })[]>(
      'SELECT alt_text AS altText FROM homepage_media WHERE media_key=?',
      [media.key],
    )
    if (existing[0] && !replaceableAltText.has(existing[0].altText)) {
      console.log(`Preserved admin-uploaded homepage image: ${media.key}`)
      continue
    }

    const data = await readFile(resolve(mediaDirectory, media.file))
    await pool.query(`
      INSERT INTO homepage_media(media_key,mime_type,alt_text,data,byte_size)
      VALUES (?, 'image/png', ?, ?, ?)
      ON DUPLICATE KEY UPDATE mime_type=VALUES(mime_type), alt_text=VALUES(alt_text),
        data=VALUES(data), byte_size=VALUES(byte_size), updated_at=CURRENT_TIMESTAMP
    `, [media.key, media.alt, data, data.length])
    console.log(`Seeded homepage image: ${media.key}`)
  }
}

seedHomepageReferenceMedia()
  .catch((error: unknown) => {
    console.error('Could not seed homepage reference media', error instanceof Error ? error.message : 'Unknown error')
    process.exitCode = 1
  })
  .finally(() => pool.end())

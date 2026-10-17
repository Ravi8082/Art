'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { SafeImage } from '@/components/home/safe-image'
import { demoArtists, demoGallery, galleryCategories } from '@/lib/demo-artist'

export type UploadedWork = { id: string; title: string; artistName: string; description: string; url: string }
type Item = {
  id: string; title: string; artist: string; category: string; medium: string; size: string; year: string
  city: string; price: number | null; views: string; likes: number; about: string; image: string; demo: boolean; avatar: string
}

const meta: Record<string, { price: number; views: string; likes: number; size: string; year: string; city: string; about: string }> = {
  g1: { price: 18000, views: '1.2K', likes: 86, size: '24 x 36 inches', year: '2024', city: 'Mumbai', about: 'A vibrant and expressive painting inspired by the bustling streets and coastal beauty of Mumbai, with bold strokes and rich textures.' },
  g2: { price: 12000, views: '980', likes: 72, size: '18 x 18 inches', year: '2023', city: 'Delhi', about: 'A mixed media study of a blooming lotus, layered with colour and delicate detail.' },
  g3: { price: 25000, views: '1.5K', likes: 110, size: '30 x 24 inches', year: '2023', city: 'Pune', about: 'A portrait exploring identity and reflection in a modern city.' },
  g4: { price: 15000, views: '2.1K', likes: 164, size: '24 x 24 inches', year: '2024', city: 'Indore', about: 'An acrylic work celebrating light, devotion and traditional motifs.' },
  g5: { price: 20000, views: '780', likes: 52, size: '36 x 30 inches', year: '2024', city: 'Jaipur', about: 'Intricate mandala patterns drawn in ink, inspired by folk traditions.' },
  g6: { price: 10000, views: '640', likes: 48, size: '18 x 24 inches', year: '2023', city: 'Bengaluru', about: 'Warm dusk colours settling over a quiet landscape.' },
  g7: { price: 14000, views: '890', likes: 69, size: '24 x 24 inches', year: '2023', city: 'Mumbai', about: 'A tree of life rendered in layered mixed media.' },
  g8: { price: 12000, views: '710', likes: 40, size: '18 x 24 inches', year: '2022', city: 'Delhi', about: 'Watercolour tides in flowing, playful colour.' },
  g9: { price: 45000, views: '320', likes: 31, size: '12 x 10 inches', year: '2023', city: 'Indore', about: 'A hand-carved stone sculpture with a quiet, meditative presence.' },
  g10: { price: 3500, views: '450', likes: 27, size: 'Assorted', year: '2024', city: 'Jaipur', about: 'Handmade crafts in festive colours.' },
  g11: { price: 16000, views: '520', likes: 35, size: '24 x 30 inches', year: '2024', city: 'Pune', about: 'A folk-inspired piece rooted in Indian origins.' },
  g12: { price: 5000, views: '300', likes: 19, size: 'Assorted', year: '2024', city: 'Bengaluru', about: 'Craft corner pieces from independent makers.' },
}

const avatarFor = (name: string) => demoArtists.find((a) => a.name === name)?.image ?? demoArtists[0].image
const inr = (n: number | null) => (n === null ? 'Price on request' : `₹ ${n.toLocaleString('en-IN')}`)
const PER_PAGE = 8
const priceRanges: Record<string, [number, number]> = { 'All Price Range': [0, Infinity], 'Under ₹10,000': [0, 10000], '₹10,000 – ₹20,000': [10000, 20000], 'Above ₹20,000': [20000, Infinity] }

export function GalleryGrid({ uploaded }: { uploaded: UploadedWork[] }) {
  const [cat, setCat] = useState('All')
  const [medium, setMedium] = useState('All Mediums')
  const [city, setCity] = useState('All Locations')
  const [range, setRange] = useState('All Price Range')
  const [sort, setSort] = useState('Newest')
  const [q, setQ] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState(0)
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [thumb, setThumb] = useState(0)

  const all: Item[] = useMemo(() => [
    ...uploaded.map((w): Item => ({ id: w.id, title: w.title, artist: w.artistName || 'THOA Gallery', category: 'Gallery uploads', medium: 'Artwork', size: '—', year: '—', city: '—', price: null, views: '—', likes: 0, about: w.description || 'Uploaded by the gallery team.', image: w.url, demo: false, avatar: demoArtists[0].image })),
    ...demoGallery.map((w): Item => ({ id: w.id, title: w.title, artist: w.artist, category: w.category, medium: w.medium, ...meta[w.id], views: meta[w.id].views, image: w.image, demo: true, avatar: avatarFor(w.artist) })),
  ], [uploaded])

  const cats = uploaded.length ? ['All', 'Gallery uploads', ...galleryCategories.slice(1)] : [...galleryCategories]
  const mediums = ['All Mediums', ...Array.from(new Set(all.map((i) => i.medium)))]
  const cities = ['All Locations', ...Array.from(new Set(all.map((i) => i.city).filter((c) => c !== '—')))]

  const shown = useMemo(() => {
    const [lo, hi] = priceRanges[range]
    const needle = q.trim().toLowerCase()
    const list = all.filter((i) =>
      (cat === 'All' || i.category === cat) && (medium === 'All Mediums' || i.medium === medium) && (city === 'All Locations' || i.city === city) &&
      (range === 'All Price Range' || (i.price !== null && i.price >= lo && i.price < hi)) &&
      (!needle || `${i.title} ${i.artist} ${i.category}`.toLowerCase().includes(needle)))
    if (sort === 'Price: Low to High') list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    if (sort === 'Price: High to Low') list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0))
    return list
  }, [all, cat, medium, city, range, q, sort])

  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE))
  const cur = Math.min(page, pages)
  const pageItems = shown.slice((cur - 1) * PER_PAGE, cur * PER_PAGE)
  const active = shown.find((i) => i.id === (pageItems[sel]?.id ?? pageItems[0]?.id)) ?? null
  const thumbs = active ? [active, ...all.filter((i) => i.id !== active.id).slice(0, 3)] : []
  const reset = (fn: () => void) => { fn(); setPage(1); setSel(0); setThumb(0) }
  const pick = (idx: number) => { setSel(idx); setThumb(0) }

  return (
    <section className="gx-wrap">
      <div className="gx-main">
        <div className="gx-head">
          <div><h2>Art Gallery</h2><p>Browse authentic artworks from verified artists of The Haat of Art.</p></div>
          <div className="gx-toggle">
            <button className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')}>▦ Grid View</button>
            <button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}>☰ List View</button>
          </div>
        </div>

        <div className="gx-filters">
          <select aria-label="Category" value={cat} onChange={(e) => reset(() => setCat(e.target.value))}>{cats.map((c) => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}</select>
          <select aria-label="Medium" value={medium} onChange={(e) => reset(() => setMedium(e.target.value))}>{mediums.map((c) => <option key={c}>{c}</option>)}</select>
          <select aria-label="Price range" value={range} onChange={(e) => reset(() => setRange(e.target.value))}>{Object.keys(priceRanges).map((c) => <option key={c}>{c}</option>)}</select>
          <select aria-label="Location" value={city} onChange={(e) => reset(() => setCity(e.target.value))}>{cities.map((c) => <option key={c}>{c}</option>)}</select>
          <select aria-label="Sort by" value={sort} onChange={(e) => reset(() => setSort(e.target.value))}>{['Newest', 'Price: Low to High', 'Price: High to Low'].map((c) => <option key={c}>{c}</option>)}</select>
          <label className="gx-search"><input type="search" placeholder="Search artworks…" value={q} onChange={(e) => reset(() => setQ(e.target.value))} /><span aria-hidden>⌕</span></label>
        </div>

        <div className="gx-pills">{cats.map((c) => <button key={c} className={c === cat ? 'is-active' : ''} onClick={() => reset(() => setCat(c))}>{c}</button>)}</div>

        {pageItems.length === 0 ? <p className="gx-empty">No artworks match these filters.</p> : (
          <div className={view === 'grid' ? 'gx-grid' : 'gx-list'}>
            {pageItems.map((i, idx) => (
              <article key={i.id} className={`gx-card${active?.id === i.id ? ' is-sel' : ''}`} onClick={() => pick(idx)}>
                <div className="gx-img">
                  <SafeImage src={i.image} alt={i.demo ? `${i.title} (demo image)` : i.title} />
                  <button type="button" className={`gx-heart${liked[i.id] ? ' is-on' : ''}`} aria-label="Add to favourites" onClick={(e) => { e.stopPropagation(); setLiked({ ...liked, [i.id]: !liked[i.id] }) }}>{liked[i.id] ? '♥' : '♡'}</button>
                  {i.demo && <em className="gl-tag">Demo</em>}
                </div>
                <div className="gx-body">
                  <b>{i.title}</b>
                  <span className="gx-by"><img src={i.avatar} alt="" />{i.artist} <i title="Verified">✔</i></span>
                  <small>{i.medium} · {i.size} · {i.year}</small>
                  <div className="gx-foot"><strong>{inr(i.price)}</strong><span>👁 {i.views}</span><span>♡ {i.likes + (liked[i.id] ? 1 : 0)}</span></div>
                </div>
              </article>
            ))}
          </div>
        )}

        <nav className="gx-pager" aria-label="Pagination">
          <button disabled={cur === 1} onClick={() => { setPage(cur - 1); setSel(0) }} aria-label="Previous">←</button>
          {Array.from({ length: pages }, (_, n) => n + 1).map((n) => <button key={n} className={n === cur ? 'is-active' : ''} onClick={() => { setPage(n); setSel(0) }}>{n}</button>)}
          <button disabled={cur === pages} onClick={() => { setPage(cur + 1); setSel(0) }} aria-label="Next">→</button>
        </nav>
      </div>

      {active && (
        <aside className="gx-detail" aria-label="Artwork details">
          <div className="gx-dimg"><SafeImage src={thumbs[thumb]?.image} alt={active.title} /></div>
          <div className="gx-thumbs">{thumbs.map((t, n) => <button key={t.id} className={n === thumb ? 'is-active' : ''} onClick={() => setThumb(n)} aria-label={`Image ${n + 1}`}><SafeImage src={t.image} alt="" /></button>)}</div>
          <h3>{active.title}</h3>
          <div className="gx-price"><strong>{inr(active.price)}</strong><span>👁 {active.views} Views</span><span>♡ {active.likes + (liked[active.id] ? 1 : 0)} likes</span></div>
          <div className="gx-artist"><img src={active.avatar} alt="" /><div><b>{active.artist} <i>✔</i></b><small>{active.city !== '—' ? `${active.city}, India` : 'The Haat of Art'}</small></div><Link href="/artist/profile">View Artist</Link></div>
          <dl className="gx-dl">
            <dt>Medium</dt><dd>{active.medium}</dd><dt>Size</dt><dd>{active.size}</dd><dt>Year</dt><dd>{active.year}</dd><dt>Category</dt><dd>{active.category}</dd><dt>Location</dt><dd>{active.city}</dd>
          </dl>
          <h4>About this Artwork</h4><p>{active.about}</p>
          {active.demo && <small className="gx-demo">Demo artwork — sample placeholder, not for sale.</small>}
          <div className="gx-share"><span>Share Artwork</span>{['W', 'f', 'X', 'P', 'in', '🔗'].map((s) => <button key={s} type="button" aria-label={`Share ${s}`}>{s}</button>)}</div>
          <div className="gx-cta">
            <button type="button" onClick={() => setLiked({ ...liked, [active.id]: !liked[active.id] })}>{liked[active.id] ? '♥ Added' : '♡ Add to Favorites'}</button>
            <Link className="th-btn" href="/contact">Inquire About Artwork →</Link>
          </div>
        </aside>
      )}
    </section>
  )
}

export function FeaturedArtists() {
  return (
    <section className="gx-feat">
      <div className="gx-feat-head"><div><h3>★ Featured Artists</h3><p>Discover talented artists and their unique collections.</p></div><Link href="/artists">View All Artists →</Link></div>
      <div className="gx-feat-row">{demoArtists.map((a) => <Link key={a.name} href="/artist/profile" className="gx-fa"><img src={a.image} alt={a.name} /><b>{a.name}</b><small>{a.city}</small></Link>)}</div>
    </section>
  )
}

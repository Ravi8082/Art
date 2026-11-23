'use client'

import type { MediaPartner, MediaPartnerPage } from '@/lib/api'
import styles from './media-alliances-marquee.module.css'

function PartnerCard({ partner }: { partner: MediaPartner }) {
  const contents = partner.logoUrl
    ? <>
        <img className={styles.logo} src={partner.logoUrl} alt="" loading="lazy" />
        <span className={styles.name}>{partner.name}</span>
      </>
    : <span className={styles.masthead}>
        <strong>{partner.name}</strong>
        {partner.category && <span className={styles.category}>{partner.category}</span>}
      </span>

  return partner.websiteUrl
    ? <a className={styles.card} href={partner.websiteUrl} target="_blank" rel="noopener noreferrer" aria-label={partner.name}>{contents}</a>
    : <div className={styles.card} aria-label={partner.name}>{contents}</div>
}

function PartnerRow({ partners, reverse = false }: { partners: MediaPartner[]; reverse?: boolean }) {
  if (!partners.length) return null
  const rowClass = `${styles.row}${reverse ? ` ${styles.rowReverse}` : ''}`
  return (
    <div className={rowClass}>
      <div className={styles.track}>
        {[0, 1].map((copy) => (
          <div className={styles.group} key={copy} aria-hidden={copy === 1} inert={copy === 1}>
            {partners.map((partner) => <PartnerCard key={`${copy}-${partner.id}`} partner={partner} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

export function MediaAlliancesMarquee({ page, partners }: { page: MediaPartnerPage; partners: MediaPartner[] }) {
  if (!partners.length) return null
  const midpoint = Math.ceil(partners.length / 2)
  const firstRow = partners.slice(0, midpoint)
  const secondRow = partners.slice(midpoint)

  return (
    <section className={`${styles.section}${page === 'about' ? ` ${styles.aboutPage}` : ''}`} aria-labelledby={`media-alliances-${page}`}>
      <header className={styles.heading}>
        <p className={styles.kicker}>National Press &amp; Outdoor Reach</p>
        <h2 id={`media-alliances-${page}`}>Media, Press &amp; Outdoor Alliances</h2>
        <p>Amplifying Indian art across leading print publications, digital newsrooms, and landmark city outdoor networks.</p>
      </header>
      <div className={styles.rows} aria-label="Media and outdoor partners">
        <PartnerRow partners={firstRow} />
        <PartnerRow partners={secondRow} reverse />
      </div>
    </section>
  )
}

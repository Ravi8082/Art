'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PartnerInquiryTrigger } from '@/components/partner-inquiry'

type VenuePartner = { id: string; name: string; websiteUrl: string | null; logo: string | undefined }

function PartnerMark({ partner }: { partner: VenuePartner }) {
  const [imageFailed, setImageFailed] = useState(false)
  if (partner.logo && !imageFailed) {
    return <img src={partner.logo} alt={partner.name} loading="lazy" onError={() => setImageFailed(true)} />
  }
  return (
    <span className="th-partner-name">
      <strong>{partner.name.split(' · ')[0]}</strong>
      {partner.name.includes(' · ') && <small>{partner.name.split(' · ').slice(1).join(' · ')}</small>}
    </span>
  )
}

export function VenuePartners({ partners }: { partners: VenuePartner[] }) {
  return (
    <aside className="th-partners" id="partners">
      <h2>Our Venue Partners</h2>
      <div className="th-partner-marquee">
        <div className="th-partner-track">
          <div className="th-partner-group">
            {partners.map((partner) => partner.websiteUrl
              ? <Link key={partner.id} href={partner.websiteUrl} target="_blank" rel="noopener noreferrer" aria-label={partner.name}><PartnerMark partner={partner} /></Link>
              : <div key={partner.id}><PartnerMark partner={partner} /></div>)}
          </div>
          <div className="th-partner-group" aria-hidden="true" inert>
            {partners.map((partner) => <div key={`duplicate-${partner.id}`}><PartnerMark partner={partner} /></div>)}
          </div>
        </div>
      </div>
      <PartnerInquiryTrigger className="th-partners-inquiry">Become a Partner <span aria-hidden="true">→</span></PartnerInquiryTrigger>
    </aside>
  )
}

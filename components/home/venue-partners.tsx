import { demoPartners } from '@/lib/demo-home-content'

export function VenuePartners({ partners = demoPartners }: { partners?: { name: string; style: string }[] }) {
  return (
    <aside className="th-partners" id="partners">
      <h3>Venue Partners</h3>
      <div>{partners.map((p) => <span key={p.name} className={`th-logo th-logo-${p.style}`}>{p.name}</span>)}</div>
    </aside>
  )
}

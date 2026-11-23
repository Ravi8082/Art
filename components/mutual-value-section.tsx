import { CircleDollarSign, Handshake, Palette } from 'lucide-react'
import type { AboutEcosystemCard } from '@/lib/api'

const icons = [Palette, Handshake, CircleDollarSign]

const homepageCards: AboutEcosystemCard[] = [
  { id: 1, cardKey: 'artists', title: 'For Artists', lead: 'Keep 100% of your exhibition sales', bodyHtml: '<p>Meet collectors directly and grow your audience through thoughtfully curated exhibitions.</p>', sortOrder: 1, isVisible: true },
  { id: 2, cardKey: 'partners', title: 'For Partners', lead: 'High-intent cultural visibility', bodyHtml: '<p>Connect your organisation with artists, collectors and a design-forward audience.</p>', sortOrder: 2, isVisible: true },
  { id: 3, cardKey: 'collectors', title: 'For Collectors', lead: 'Discover art and its makers', bodyHtml: '<p>Explore original work and build meaningful connections with its creators.</p>', sortOrder: 3, isVisible: true },
]

export function MutualValueSection({
  kicker = 'A transparent art ecosystem',
  title = 'Built for Artists, Partners & Collectors',
  subtitle = 'Clear value for every participant—and a sustainable model that keeps the focus on art.',
  cards = homepageCards,
}: {
  kicker?: string
  title?: string
  subtitle?: string
  cards?: AboutEcosystemCard[]
}) {
  return (
    <section className="mutual-value-section" aria-labelledby="mutual-value-title">
      <header className="mutual-value-heading">
        <p className="mutual-value-eyebrow">{kicker}</p>
        <h2 id="mutual-value-title">{title}</h2>
        <p>{subtitle}</p>
      </header>
      <div className="mutual-value-grid">
        {cards.map((card, index) => {
          const Icon = icons[index % icons.length]
          return (
            <article className="mutual-value-card" key={card.id}>
              <div className="mutual-value-card-top">
                <span className="mutual-value-number">{String(card.sortOrder).padStart(2, '0')}</span>
                <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
              </div>
              <h3>{card.title}</h3>
              {card.lead && <p className="mutual-value-lead">{card.lead}</p>}
              {card.bodyHtml && <div dangerouslySetInnerHTML={{ __html: card.bodyHtml }} />}
            </article>
          )
        })}
      </div>
    </section>
  )
}

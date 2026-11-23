import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { AboutTeamMember } from '@/lib/api'
import type { HomepageContent } from '@/lib/homepage-content'
import { TeamPortrait } from '@/components/team-portrait'
import { SafeImage } from './safe-image'

function ImpactValue({ value }: { value: string }) {
  return <strong>{value}</strong>
}

function memberInitials(name: string) {
  return (name.match(/[A-Za-z0-9]+/g) ?? []).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'TH'
}

export function ImpactStrip({
  aboutImage,
  aboutAlt,
  aboutTitle,
  aboutAccent,
  aboutText,
  items,
  leaders,
  apiBaseUrl,
  showStory,
  showLeadership,
  showImpact,
}: {
  aboutImage?: string
  aboutAlt: string
  aboutTitle: string
  aboutAccent: string
  aboutText: string
  items: HomepageContent['impact']
  leaders: AboutTeamMember[]
  apiBaseUrl: string
  showStory: boolean
  showLeadership: boolean
  showImpact: boolean
}) {
  const leaderRole = (member: AboutTeamMember) => member.badgeLabel || member.role || member.designation || 'Leadership'
  const leaderPhoto = (member: AboutTeamMember) => member.photoUrl
    ? (/^https?:\/\//i.test(member.photoUrl) ? member.photoUrl : `${apiBaseUrl}${member.photoUrl}`)
    : null
  const featuredLeader = leaders[0]

  if (!showStory && !showLeadership && !showImpact) return null

  return (
    <section className="th-home-editorial-spread" aria-label="About The Haat of Art, leadership and impact">
      {(showStory || (showLeadership && leaders.length > 0)) && <div className="th-home-editorial-top">
        {showStory && <article className="th-home-story">
          <div className="th-home-story-copy">
            <p className="th-eyebrow">OUR STORY</p>
            <h2>{aboutTitle} <em>{aboutAccent}</em></h2>
            <p>{aboutText}</p>
            <Link className="th-btn-outline th-home-story-link" href="/about">Know More About Us <ArrowRight size={16} /></Link>
          </div>
          <SafeImage className="th-home-story-image" src={aboutImage} alt={aboutAlt} fallback="/media/exhibition-gallery.jpeg" />
        </article>}
        {showLeadership && leaders.length === 1 && featuredLeader && (
          <aside className="th-home-mentor-card" aria-label={`${leaderRole(featuredLeader)}: ${featuredLeader.name}`}>
            <TeamPortrait
              src={leaderPhoto(featuredLeader)}
              alt={`Portrait of ${featuredLeader.name}`}
              initials={memberInitials(featuredLeader.name)}
              className="th-home-mentor-image"
              imageClassName="th-home-mentor-photo"
              fallbackClassName="th-home-leader-monogram"
            />
            <div className="th-home-mentor-copy">
              <p className="th-eyebrow">{leaderRole(featuredLeader)}</p>
              <h3>{featuredLeader.name}</h3>
              {featuredLeader.bio && <p>{featuredLeader.bio}</p>}
              <Link href="/about">Meet the team <ArrowRight size={15} /></Link>
            </div>
          </aside>
        )}
        {showLeadership && leaders.length > 1 && (
          <aside className="th-home-leadership-card" aria-labelledby="th-home-leadership-title">
            <header>
              <div>
                <p className="th-eyebrow">OUR PEOPLE</p>
                <h3 id="th-home-leadership-title">Leadership &amp; Core Team</h3>
              </div>
              <Link href="/about">Meet the team <ArrowRight size={15} /></Link>
            </header>
            <div className="th-home-leadership-list" data-count={Math.min(leaders.length, 3)} role="region" aria-label="Leadership profiles" tabIndex={0}>
              {leaders.map((member) => (
                <article className="th-home-leadership-member" key={member.id}>
                  <TeamPortrait
                    src={leaderPhoto(member)}
                    alt={member.name}
                    initials={memberInitials(member.name)}
                    className="th-home-leadership-photo"
                    imageClassName="th-home-leadership-photo-image"
                    fallbackClassName="th-home-leadership-fallback"
                  />
                  <p className="th-home-leadership-role">{leaderRole(member)}</p>
                  <h4>{member.name}</h4>
                  {member.bio && <p className="th-home-leadership-bio">{member.bio}</p>}
                </article>
              ))}
            </div>
          </aside>
        )}
      </div>}
      {showImpact && items.length > 0 && <div className="th-home-impact">
        <h2>Our <strong>Impact</strong></h2>
        <div className="th-home-impact-metrics">
          {items.map((item) => (
            <article key={item.label}>
              <ImpactValue value={item.value} />
              <span>{item.label}</span>
            </article>
          ))}
        </div>
      </div>}
    </section>
  )
}

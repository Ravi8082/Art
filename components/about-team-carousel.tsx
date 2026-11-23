'use client'

import { useEffect, useRef, useState } from 'react'
import { UserRound, X } from 'lucide-react'
import type { AboutTeamMember } from '@/lib/api'
import { TeamPortrait } from '@/components/team-portrait'

function getPhotoUrl(photoUrl: string | null, apiBaseUrl: string) {
  if (!photoUrl) return null
  return /^https?:\/\//i.test(photoUrl) ? photoUrl : `${apiBaseUrl}${photoUrl}`
}

function getMonogram(member: AboutTeamMember) {
  return (member.name.match(/[A-Za-z0-9]+/g) ?? [])
    .slice(0, 4)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'TH'
}

export function AboutTeamCarousel({ members, apiBaseUrl }: {
  members: AboutTeamMember[]
  apiBaseUrl: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selectedMember, setSelectedMember] = useState<AboutTeamMember | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selectedMember && !dialog.open) dialog.showModal()
    if (!selectedMember && dialog.open) dialog.close()
  }, [selectedMember])

  const selectedPhoto = selectedMember ? getPhotoUrl(selectedMember.photoUrl, apiBaseUrl) : null
  const featuredMembers = members
    .filter((member) => member.isFeaturedMentor || /founder/i.test(member.role || member.designation))
    .sort((a, b) => {
      const priority = (member: AboutTeamMember) => member.isFeaturedMentor ? 0 : /founder\s*&\s*ceo/i.test(member.role) ? 1 : 2
      return priority(a) - priority(b) || a.sortOrder - b.sortOrder
    })
  const featuredIds = new Set(featuredMembers.map((member) => member.id))
  const coreMembers = members.filter((member) => !featuredIds.has(member.id))

  function renderMembers(teamMembers: AboutTeamMember[]) {
    return (
      <div className="about-ref-team-grid" role="region" aria-label="Leadership and core team members" tabIndex={0}>
        {teamMembers.map((member) => {
          const photo = getPhotoUrl(member.photoUrl, apiBaseUrl)
          return (
            <article className="about-ref-member" key={member.id}>
              <button
                className="about-ref-member-trigger"
                type="button"
                aria-haspopup="dialog"
                aria-label={`View ${member.name}'s profile`}
                onClick={() => setSelectedMember(member)}
              >
                <TeamPortrait
                  src={photo}
                  alt={member.name}
                  initials={getMonogram(member)}
                  className="about-ref-member-photo"
                  imageClassName="about-ref-member-photo-image"
                  fallbackClassName="about-ref-member-crest"
                />
                <span className="about-ref-member-role">{member.badgeLabel || member.role || member.designation}</span>
                <h4 className="about-ref-member-name">{member.name}</h4>
                {member.bio && <span className="about-ref-member-bio">{member.bio}</span>}
                <span className="about-ref-profile-badge"><UserRound size={14} aria-hidden="true" /> View Profile</span>
              </button>
              {(member.facebookUrl || member.linkedinUrl || member.instagramUrl) && (
                <nav className="about-ref-socials" aria-label={`${member.name} social links`}>
                  {member.facebookUrl && <a href={member.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a>}
                  {member.linkedinUrl && <a href={member.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
                  {member.instagramUrl && <a href={member.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram</a>}
                </nav>
              )}
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {featuredMembers.length > 0 && (
        <section className="about-ref-leadership-group" aria-labelledby="about-ref-featured-leadership">
          <h3 id="about-ref-featured-leadership">Featured Mentor &amp; Founders</h3>
          {renderMembers(featuredMembers)}
        </section>
      )}
      {coreMembers.length > 0 && (
        <section className="about-ref-leadership-group" aria-labelledby="about-ref-core-leadership">
          <h3 id="about-ref-core-leadership">Leadership &amp; Core Team</h3>
          {renderMembers(coreMembers)}
        </section>
      )}

      <dialog
        className="about-ref-member-dialog"
        ref={dialogRef}
        aria-labelledby="about-ref-member-dialog-title"
        onCancel={() => setSelectedMember(null)}
        onClose={() => setSelectedMember(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSelectedMember(null)
        }}
      >
        {selectedMember && (
          <div className="about-ref-member-dialog-content">
            <button className="about-ref-member-dialog-close" type="button" aria-label="Close team member profile" onClick={() => setSelectedMember(null)}>
              <X size={20} />
            </button>
            <TeamPortrait
              src={selectedPhoto}
              alt={selectedMember.name}
              initials={getMonogram(selectedMember)}
              className="about-ref-member-dialog-photo-frame"
              imageClassName="about-ref-member-dialog-photo"
              fallbackClassName="about-ref-member-dialog-placeholder"
            />
            <div className="about-ref-member-dialog-copy">
              <span className="about-ref-eyebrow">Leadership &amp; Core Team</span>
              <h2 id="about-ref-member-dialog-title">{selectedMember.name}</h2>
              {(selectedMember.badgeLabel || selectedMember.role || selectedMember.designation) && (
                <p className="about-ref-member-dialog-role">{selectedMember.badgeLabel || selectedMember.role || selectedMember.designation}</p>
              )}
              {selectedMember.bio && <p className="about-ref-member-dialog-bio">{selectedMember.bio}</p>}
              {(selectedMember.facebookUrl || selectedMember.linkedinUrl || selectedMember.instagramUrl) && (
                <nav className="about-ref-member-dialog-links" aria-label={`${selectedMember.name} social links`}>
                  {selectedMember.facebookUrl && <a href={selectedMember.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a>}
                  {selectedMember.linkedinUrl && <a href={selectedMember.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
                  {selectedMember.instagramUrl && <a href={selectedMember.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram</a>}
                </nav>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}

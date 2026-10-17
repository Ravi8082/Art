'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  apiBaseUrl, bookingApi, formatEventDates, formatMoney, getMine, getStalls, stallSize,
  taxRatePercent, totalWithTax, uploadApplicationMedia,
  type BookingUser, type Exhibition, type MineApplication, type MyBooking, type Stall, type StallType,
} from '@/lib/booking-api'
import {
  CityTabs, ExhibitionCards, ImageUploader, PdfUploader, PreferenceChecklist,
  RichTextEditor, SignInPanel, StallMap, categoryLabel,
} from './booking-parts'
import { PaymentStage } from './booking-payment'
import { pillLabel } from './booking-labels'
import { EmailOtpForm } from '@/components/email-otp-form'

const artForms = [
  'Painting', 'Contemporary Painting', 'Classical / Traditional Painting', 'Sculpture', 'Photography',
  'Digital Art', 'Printmaking', 'Ceramics & Pottery', 'Textile & Fabric', 'Crafts & Folk Art',
  'Jewellery & Adornment', 'Calligraphy & Manuscript', 'Mixed Media', 'Installation', 'Art Books & Zines',
]

const spaceOptions = [
  { id: 'INDIVIDUAL', label: 'Individual Stall' },
  { id: 'GROUP', label: 'Group Stall' },
  { id: 'GALLERY', label: 'Gallery Space' },
] as const

const steps = ['Personal Details', 'Artwork Details', 'Preferences', 'Select Stall', 'Review'] as const

type Pictures = { id: string; file: File; previewUrl: string }[]
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6

export function BookingWizard({ exhibitions, stallTypes, initialUser, heroImage }: {
  exhibitions: Exhibition[]
  stallTypes: StallType[]
  initialUser: BookingUser | null
  heroImage: { src: string; alt: string }
}) {
  const [user, setUser] = useState(initialUser)
  const [step, setStep] = useState<Step>(0)
  const [city, setCity] = useState('All')
  const [eventIds, setEventIds] = useState<string[]>([])
  const [personal, setPersonal] = useState({ firstName: '', lastName: '', phone: '', address: '' })
  const [art, setArt] = useState({ artForm: '', fasciaName: '', bio: '', websiteUrl: '', instagramUrl: '' })
  const [prefs, setPrefs] = useState({ spaceCategory: '', stallTypeId: '', approxSize: '', requirements: '' })
  const [pictures, setPictures] = useState<Pictures>([])
  const [portfolio, setPortfolio] = useState<File | null>(null)
  const [stalls, setStalls] = useState<Stall[]>([])
  const [stallId, setStallId] = useState('')
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<MineApplication[]>([])
  const [mine, setMine] = useState<{ applications: MineApplication[]; bookings: MyBooking[] } | null>(null)
  const [authError, setAuthError] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const wizardRef = useRef<HTMLElement>(null)

  const eventId = eventIds[0] ?? ''
  const exhibition = exhibitions.find((entry) => entry.id === eventId) ?? null
  const cities = useMemo(() => [...new Set(exhibitions.map((entry) => entry.city).filter(Boolean))].sort(), [exhibitions])
  const visible = city === 'All' ? exhibitions : exhibitions.filter((entry) => entry.city === city)
  const stall = stalls.find((entry) => entry.id === stallId) ?? null
  const preferredType = stallTypes.find((entry) => entry.id === prefs.stallTypeId) ?? null

  const loadMine = useCallback(async () => {
    if (!user) { setMine(null); return }
    try { setMine(await getMine()) } catch { setMine(null) }
  }, [user])

  useEffect(() => { void loadMine() }, [loadMine])

  useEffect(() => {
    if (!eventId) { setStalls([]); return }
    let cancelled = false
    getStalls(eventId).then((rows) => { if (!cancelled) setStalls(rows) }).catch(() => { if (!cancelled) setStalls([]) })
    return () => { cancelled = true }
  }, [eventId])

  useEffect(() => {
    wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  function signIn(email: string, password: string) {
    setAuthError('')
    return bookingApi<{ userId: string }>('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
    }).then(async () => {
      const fresh = await bookingApi<{ user: BookingUser }>('/api/auth/me')
      setUser(fresh.user)
    }).catch((cause: unknown) => {
      setAuthError(cause instanceof Error ? cause.message : 'Sign in failed')
      throw cause
    })
  }

  function register(fullName: string, email: string, password: string) {
    setAuthError('')
    return bookingApi<{ email: string; otpRequired: boolean; otpSent: boolean; message: string }>('/api/auth/register-exhibitor', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fullName, email, password }),
    }).then((result) => {
      setVerificationEmail(email)
      setVerificationMessage(result.message)
    }).catch((cause: unknown) => {
      setAuthError(cause instanceof Error ? cause.message : 'Could not create the account')
      throw cause
    })
  }

  function signOut() {
    void bookingApi<void>('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    setUser(null)
    setMine(null)
  }

  function addPictures(files: File[]) {
    setPictures((current) => [...current, ...files.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }))])
  }

  function removePicture(id: string) {
    setPictures((current) => {
      const target = current.find((entry) => entry.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((entry) => entry.id !== id)
    })
  }

  function validateStep(target: Step) {
    const next: Record<string, string> = {}
    if (target > 1) {
      if (personal.firstName.trim().length < 2) next.firstName = 'Enter your first name.'
      if (!/^[0-9+()\s-]{6,30}$/.test(personal.phone.trim())) next.phone = 'Enter a valid phone number.'
      if (personal.address.trim().length < 6) next.address = 'Enter your complete address.'
    }
    if (target > 2) {
      if (!art.artForm) next.artForm = 'Choose your art form.'
      const plain = art.bio.replace(/<[^>]*>/g, '').trim()
      if (plain.length < 20) next.bio = 'Tell us about your artwork in at least 20 characters.'
      if (art.websiteUrl && !isUrl(art.websiteUrl)) next.websiteUrl = 'Use a full web address, e.g. https://yourstudio.com'
      if (art.instagramUrl && !isUrl(art.instagramUrl)) next.instagramUrl = 'Use a full profile link, e.g. https://instagram.com/yourhandle'
    }
    if (target > 3) {
      if (!eventId) next.eventIds = 'Select the exhibition you want to book for.'
      if (!prefs.spaceCategory) next.spaceCategory = 'Choose the kind of space you need.'
    }
    if (target > 5) {
      if (!pictures.length) next.pictures = 'Upload at least one artwork image.'
      if (!agree) next.agree = 'Please accept the terms and exhibition guidelines.'
    }
    setErrors(next)
    return !Object.keys(next).length
  }

  function go(target: Step) {
    if (target > step && !validateStep(target)) return
    setStep(target)
  }

  async function submitApplication() {
    if (!validateStep(6) || !user) return
    setBusy(true)
    setError('')
    try {
      const artworkAssetIds: string[] = []
      for (const picture of pictures) {
        artworkAssetIds.push((await uploadApplicationMedia(picture.file, 'artwork', picture.file.name)).assetId)
      }
      const portfolioAssetId = portfolio ? (await uploadApplicationMedia(portfolio, 'portfolio', portfolio.name)).assetId : null
      const payload = {
        firstName: personal.firstName.trim(), lastName: personal.lastName.trim(), phone: personal.phone.trim(),
        address: personal.address.trim(), websiteUrl: normaliseUrl(art.websiteUrl), instagramUrl: normaliseUrl(art.instagramUrl),
        artForm: art.artForm, fasciaName: art.fasciaName.trim(), bio: art.bio,
        spaceCategory: prefs.spaceCategory as 'INDIVIDUAL' | 'GROUP' | 'GALLERY',
        preferredStallTypeId: prefs.stallTypeId || null,
        requestedStallId: stallId || null,
        approxSizeSqm: prefs.approxSize ? Number(prefs.approxSize) : null,
        specialRequirements: prefs.requirements.trim(),
        artworkAssetIds, portfolioAssetId, agreeTerms: true,
      }
      const applied = await bookingApi<{ id: string; applicationRef: string; status: MineApplication['status'] }>(
        '/api/bookings/applications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, eventId }) },
      )
      const list = await getMine()
      const record = list.applications.find((entry) => entry.id === applied.id) ?? {
        id: applied.id, applicationRef: applied.applicationRef, status: applied.status, createdAt: new Date().toISOString(),
        eventId, adminNotes: null, requestedStallId: stallId || null, requestedStallCode: stall?.code ?? null,
        eventTitle: exhibition?.title ?? '', eventCity: exhibition?.city ?? '', eventStartsAt: exhibition?.startsAt ?? '',
      }
      setSubmitted([record])
      setStep(6)
      await loadMine()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your application could not be submitted. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const approved = submitted.map((entry) => mine?.applications.find((row) => row.id === entry.id) ?? entry)
  const payable = approved.find((entry) => entry.status === 'APPROVED' && !mine?.bookings.length)
  const paidBooking = mine?.bookings.find((entry) => ['PAYMENT_PENDING', 'CONFIRMED'].includes(entry.status))

  return (
    <div className="bw-root">
      {step === 0 && (
        <>
          <section className="bw-hero">
            <div className="bw-hero-media">
              <img src={heroImage.src} alt={heroImage.alt} />
              <span className="bw-hero-shade" aria-hidden="true" />
            </div>
            <div className="bw-hero-copy">
              <p className="bw-hero-eyebrow">Join India&apos;s Biggest Art Exhibition</p>
              <h1>Book Your Stall</h1>
              <p>Be a part of India&apos;s most vibrant art exhibitions.</p>
              <ul className="bw-hero-points">
                <li><span aria-hidden="true">◈</span><b>Showcase</b> Your Art</li>
                <li><span aria-hidden="true">◈</span><b>Grow</b> Your Network</li>
                <li><span aria-hidden="true">◈</span><b>Be Part</b> of a Creative Community</li>
              </ul>
            </div>
          </section>

          <section className="bw-section">
            <h2 className="bw-h2">Upcoming Exhibitions</h2>
            <CityTabs cities={cities} active={city} onChange={setCity} />
            <ExhibitionCards exhibitions={visible} selectedIds={eventIds} mediaBase={apiBaseUrl}
              onToggle={(id) => {
                if (eventIds[0] === id) {
                  setEventIds([])
                  return
                }
                setEventIds([id])
                setErrors({})
                setStep(1)
              }} />
            {errors.eventIds && <p className="bw-field-error" role="alert">{errors.eventIds}</p>}
          </section>
        </>
      )}

      {step > 0 && (
        <section className="bw-wizard" ref={wizardRef}>
          <div className="bw-head">
            <button className="bw-change-event" type="button" onClick={() => { setEventIds([]); setErrors({}); setStep(0) }}>
              ← Change exhibition
            </button>
            <img src="/media/logo.png" alt="" aria-hidden="true" />
            <h2>Registration for Exhibitor / Artist</h2>
          {exhibition && <p className="bw-head-event"><strong>{exhibition.title}</strong><span>{formatEventDates(exhibition.startsAt, exhibition.endsAt)} · {exhibition.venue || exhibition.city}</span></p>}
        </div>
          <ol className="bw-steps">
            {steps.map((label, index) => {
              const number = index + 1
              const state = step === number ? 'is-active' : step > number ? 'is-done' : ''
              return (
                <li key={label} className={state}>
                  <button type="button" disabled={number > step} onClick={() => go(number as Step)}>
                    <span className="bw-dot">{number}</span>
                    <span className="bw-step-label">{label}</span>
                  </button>
                </li>
              )
            })}
          </ol>

          {step === 1 && (
            <Panel title="Personal Details">
              {!user && (verificationEmail
                ? <EmailOtpForm email={verificationEmail} initialMessage={verificationMessage} onVerified={async () => {
                  const fresh = await bookingApi<{ user: BookingUser }>('/api/auth/me')
                  setUser(fresh.user)
                  setVerificationEmail('')
                }} />
                : <SignInPanel busy={busy} error={authError} onSuccess={() => undefined} onSignIn={signIn} onRegister={register} />)}
              {user && (
                <>
                  <div className="bw-row">
                    <Field label="First Name" required error={errors.firstName}>
                      <input value={personal.firstName} maxLength={80} autoComplete="given-name" placeholder="Enter your first name"
                        onChange={(event) => setPersonal({ ...personal, firstName: event.target.value })} />
                    </Field>
                    <Field label="Last Name" error={errors.lastName}>
                      <input value={personal.lastName} maxLength={80} autoComplete="family-name" placeholder="Enter your last name"
                        onChange={(event) => setPersonal({ ...personal, lastName: event.target.value })} />
                    </Field>
                  </div>
                  <Field label="Phone Number" required error={errors.phone}>
                    <div className="bw-phone">
                      <span className="bw-dial" aria-hidden="true">🇮🇳 +91</span>
                      <input value={personal.phone} maxLength={30} inputMode="tel" autoComplete="tel" placeholder="Enter phone number"
                        onChange={(event) => setPersonal({ ...personal, phone: event.target.value })} />
                    </div>
                  </Field>
                  <Field label="Email Address" required>
                    <div className="bw-locked">
                      <input value={userEmail(user)} readOnly aria-readonly="true" />
                      <span>Linked to your signed-in exhibitor account</span>
                    </div>
                  </Field>
                  <Field label="Address" required error={errors.address}>
                    <textarea rows={3} value={personal.address} maxLength={500} placeholder="Enter your complete address"
                      onChange={(event) => setPersonal({ ...personal, address: event.target.value })} />
                  </Field>
                  <div className="bw-row">
                    <Field label="Website" error={errors.websiteUrl}>
                      <input value={art.websiteUrl} maxLength={500} placeholder="https://" onChange={(event) => setArt({ ...art, websiteUrl: event.target.value })} />
                    </Field>
                    <Field label="Instagram ID" error={errors.instagramUrl}>
                      <input value={art.instagramUrl} maxLength={500} placeholder="https://instagram.com/yourhandle" onChange={(event) => setArt({ ...art, instagramUrl: event.target.value })} />
                    </Field>
                  </div>
                  <div className="bw-actions">
                    <button className="bw-btn-ghost" type="button" onClick={signOut}>Sign out</button>
                    <button className="bw-btn-primary" type="button" onClick={() => go(2)}>Save &amp; Continue →</button>
                  </div>
                </>
              )}
              {!user && <button className="bw-btn-ghost" type="button" onClick={() => setStep(0)}>← Back</button>}
            </Panel>
          )}

          {step === 2 && (
            <Panel title="About Your Artwork">
              <Field label="Art Form" required error={errors.artForm}>
                <select value={art.artForm} onChange={(event) => setArt({ ...art, artForm: event.target.value })}>
                  <option value="">Select art form</option>
                  {artForms.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                </select>
              </Field>
              <Field label="Name on Fascia (Booth Name)">
                <input value={art.fasciaName} maxLength={160} placeholder="Enter name on fascia" onChange={(event) => setArt({ ...art, fasciaName: event.target.value })} />
              </Field>
              <Field label="Tell us about yourself and your artwork" required error={errors.bio}>
                <RichTextEditor value={art.bio} invalid={Boolean(errors.bio)} placeholder="Write about your artistic journey, style, inspirations and collections…" onChange={(bio) => setArt({ ...art, bio })} />
              </Field>
              <div className="bw-field">
                <span className="bw-label">Upload Artwork Images (Max 10)</span>
                <ImageUploader files={pictures} onAdd={addPictures} onRemove={removePicture} />
                {errors.pictures && <p className="bw-field-error" role="alert">{errors.pictures}</p>}
              </div>
              <div className="bw-field">
                <span className="bw-label">Upload Portfolio (PDF - Optional)</span>
                <PdfUploader file={portfolio ? { file: portfolio, name: portfolio.name } : null} onAdd={setPortfolio} onRemove={() => setPortfolio(null)} />
              </div>
              <div className="bw-actions">
                <button className="bw-btn-ghost" type="button" onClick={() => setStep(1)}>← Back</button>
                <button className="bw-btn-primary" type="button" onClick={() => go(3)}>Save &amp; Continue →</button>
              </div>
            </Panel>
          )}

          {step === 3 && (
            <Panel title="Exhibition Preference">
              <div className="bw-field">
                <span className="bw-label">Select Exhibition <em>*</em></span>
                <PreferenceChecklist exhibitions={exhibitions.filter((entry) => entry.registrationOpen)} selectedIds={eventIds}
                  onToggle={(id) => { setEventIds((current) => current[0] === id ? [] : [id]); setStallId('') }} />
                {errors.eventIds && <p className="bw-field-error" role="alert">{errors.eventIds}</p>}
                <p className="bw-hint">One exhibition per application — you can apply to the others any time after this one is confirmed.</p>
              </div>
              <div className="bw-field">
                <span className="bw-label">Space size looking for <em>*</em></span>
                <div className="bw-spaces">
                  {spaceOptions.map((option) => (
                    <label key={option.id} className={`bw-space ${prefs.spaceCategory === option.id ? 'is-active' : ''}`}>
                      <input type="radio" name="bw-space" value={option.id} checked={prefs.spaceCategory === option.id}
                        onChange={() => setPrefs({ ...prefs, spaceCategory: option.id })} />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                {errors.spaceCategory && <p className="bw-field-error" role="alert">{errors.spaceCategory}</p>}
              </div>
              <Field label="Preferred Stall Type">
                <select value={prefs.stallTypeId} onChange={(event) => setPrefs({ ...prefs, stallTypeId: event.target.value })}>
                  <option value="">Select stall type</option>
                  {stallTypes.filter((type) => !prefs.spaceCategory || type.category === prefs.spaceCategory).map((type) => (
                    <option key={type.id} value={type.id}>{type.name} · {stallSize(type)} · {formatMoney(totalWithTax(Number(type.price), Number(type.taxRate)).total)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Approx. Size (in sq m)">
                <input value={prefs.approxSize} inputMode="decimal" placeholder="Enter space required" maxLength={6}
                  onChange={(event) => setPrefs({ ...prefs, approxSize: event.target.value.replace(/[^0-9.]/g, '') })} />
              </Field>
              <Field label="Additional Requirements (Optional)">
                <textarea rows={3} value={prefs.requirements} maxLength={500} placeholder="Any special requirements like wall type, power, lighting etc…"
                  onChange={(event) => setPrefs({ ...prefs, requirements: event.target.value })} />
              </Field>
              <div className="bw-actions">
                <button className="bw-btn-ghost" type="button" onClick={() => setStep(2)}>← Back</button>
                <button className="bw-btn-primary" type="button" onClick={() => go(4)}>Save &amp; Continue →</button>
              </div>
            </Panel>
          )}

          {step === 4 && (
            <Panel title={exhibition ? `Stall Layout & Selection — ${exhibition.title}` : 'Stall Layout & Selection'}>
              {!exhibition && <p className="bw-empty">Go back to Preferences and pick an exhibition to see its floor plan.</p>}
              {exhibition && (
                <>
                  <StallMap stalls={stalls} selectedId={stallId} onSelect={setStallId}
                    coverUrl={exhibition.media[0] ? `${apiBaseUrl}${exhibition.media[0].url}` : undefined} coverAlt={exhibition.title} />
                  <div className="bw-actions">
                    <button className="bw-btn-ghost" type="button" onClick={() => setStep(3)}>← Back</button>
                    <button className="bw-btn-primary" type="button" onClick={() => go(5)}>
                      {stall ? `Confirm Selection — ${stall.code} →` : 'Continue without a stall →'}
                    </button>
                  </div>
                </>
              )}
            </Panel>
          )}

          {step === 5 && (
            <Panel title="Review & Submit">
              <ReviewBlock title="Personal Details" onEdit={() => setStep(1)} rows={[
                ['Name', `${personal.firstName} ${personal.lastName}`.trim() || '—'],
                ['Phone', personal.phone || '—'],
                ['Email', userEmail(user) || '—'],
                ['Address', personal.address || '—'],
                ...(art.websiteUrl ? [['Website', art.websiteUrl] as [string, string]] : []),
              ]} />
              <ReviewBlock title="Artwork Details" onEdit={() => setStep(2)} rows={[
                ['Art Form', art.artForm || '—'],
                ['Name on Fascia', art.fasciaName || '—'],
                ['Description', `${art.bio.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)}…`],
              ]}>
                {pictures.length > 0 && <div className="bw-review-imgs">{pictures.map((entry) => <img key={entry.id} src={entry.previewUrl} alt={entry.file.name} />)}</div>}
              </ReviewBlock>
              <ReviewBlock title="Exhibition & Stall" onEdit={() => setStep(3)} rows={[
                ['Exhibition', exhibition?.title ?? '—'],
                ['Dates', exhibition ? formatEventDates(exhibition.startsAt, exhibition.endsAt) : '—'],
                ['Venue', exhibition ? [exhibition.venue, exhibition.city].filter(Boolean).join(', ') : '—'],
                ['Space', prefs.spaceCategory ? categoryLabel(prefs.spaceCategory) : '—'],
                ['Preferred Type', preferredType?.name ?? 'Any'],
                ['Stall', stall ? `${stall.code} (${stall.type.name})` : 'Suggest one for me'],
                ...(prefs.approxSize ? [['Approx. Size', `${prefs.approxSize} sq m`] as [string, string]] : []),
                ...(prefs.requirements ? [['Special Requirements', prefs.requirements] as [string, string]] : []),
              ]}>
                {stall && (
                  <dl className="bw-review-price">
                    <div><dt>Stall Price</dt><dd>{formatMoney(stall.type.price)}</dd></div>
                    <div><dt>GST ({taxRatePercent(stall.type.taxRate)}%)</dt><dd>{formatMoney(totalWithTax(Number(stall.type.price), Number(stall.type.taxRate)).tax)}</dd></div>
                    <div className="bw-total"><dt>Total Amount</dt><dd>{formatMoney(totalWithTax(Number(stall.type.price), Number(stall.type.taxRate)).total)}</dd></div>
                  </dl>
                )}
              </ReviewBlock>
              <label className={`bw-agree ${agree ? 'is-checked' : ''}`}>
                <input type="checkbox" checked={agree} onChange={(event) => setAgree(event.target.checked)} />
                <span>I agree to the terms &amp; conditions and exhibition guidelines.</span>
              </label>
              {errors.agree && <p className="bw-field-error" role="alert">{errors.agree}</p>}
              {error && <p className="bw-field-error" role="alert">{error}</p>}
              <div className="bw-actions">
                <button className="bw-btn-ghost" type="button" onClick={() => setStep(4)}>← Back</button>
                <button className="bw-btn-primary" type="button" disabled={busy || !user} onClick={submitApplication}>{busy ? 'Submitting…' : 'Submit Application'}</button>
              </div>
              {!user && <p className="bw-field-error">Please sign in before submitting — go back to step 1.</p>}
            </Panel>
          )}

          {step === 6 && (
            <Panel title="Application Status">
              <div className="bw-submitted">
                {approved.map((entry) => (
                  <div key={entry.id} className="bw-submitted-row">
                    <div>
                      <p className="bw-submitted-kicker">Application ID</p>
                      <strong>{entry.applicationRef}</strong>
                      <p>{entry.eventTitle}{entry.requestedStallCode ? ` · Stall ${entry.requestedStallCode}` : ''}</p>
                    </div>
                    <span className={`bw-pill is-${entry.status.toLowerCase()}`}>{pillLabel(entry.status)}</span>
                  </div>
                ))}
              </div>
              <p className="bw-note">Your application is with the curation team. Approval and payment are tracked separately — the payment window opens only after approval. Track the status any time from <a href="/artist/bookings">My bookings</a>.</p>
              {approved.some((entry) => entry.status === 'SUBMITTED' || entry.status === 'UNDER_REVIEW') && (
                <button className="bw-btn-outline" type="button" onClick={loadMine}>Refresh status</button>
              )}
              {error && <p className="bw-field-error" role="alert">{error}</p>}

              {payable && exhibition && (
                <div className="bw-paywrap">
                  <h3>Approval received — book and pay for your stall</h3>
                  <PaymentStage application={payable} exhibition={exhibition} mediaBase={apiBaseUrl} onChanged={loadMine} />
                </div>
              )}

              {paidBooking && (
                <div className="bw-paywrap">
                  <h3>Your booking</h3>
                  <p className="bw-hint">Booking <strong>{paidBooking.bookingRef}</strong> · {paidBooking.stallCode} ({paidBooking.stallTypeName}) · {formatMoney(paidBooking.totalAmount)} · status {pillLabel(paidBooking.status)}</p>
                  <a className="bw-btn-primary" href="/artist/bookings">Track it on your dashboard</a>
                </div>
              )}

              {!payable && !paidBooking && approved.every((entry) => entry.status === 'APPROVED') && (
                <p className="bw-note">All of your applications are approved. Pick a stall and complete payment above.</p>
              )}
            </Panel>
          )}
        </section>
      )}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bw-panel">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className="bw-field">
      <span className="bw-label">{label} {required && <em>*</em>}</span>
      {children}
      {error && <p className="bw-field-error" role="alert">{error}</p>}
    </div>
  )
}

function ReviewBlock({ title, rows, onEdit, children }: { title: string; rows: [string, string][]; onEdit: () => void; children?: ReactNode }) {
  return (
    <div className="bw-review">
      <h4>{title}<button type="button" aria-label={`Edit ${title}`} onClick={onEdit}>✎</button></h4>
      <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {children}
    </div>
  )
}

function isUrl(value: string) {
  try { new URL(value.startsWith('http') ? value : `https://${value}`); return true } catch { return false }
}

function normaliseUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function userEmail(user: BookingUser | null) {
  return user?.email ?? ''
}

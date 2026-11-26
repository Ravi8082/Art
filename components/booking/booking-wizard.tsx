'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  apiBaseUrl, bookingApi, formatEventDates, formatMoney, getEventStallTypes, getMine, getStalls, holdStall, releaseStallHold, stallSize, stallSquareMeters,
  taxRatePercent, totalWithTax, uploadApplicationMedia,
  type BookingProfile, type BookingUser, type Exhibition, type MineApplication, type MyBooking, type Stall, type StallType,
} from '@/lib/booking-api'
import {
  CityTabs, ExhibitionCards, ImageUploader, PdfUploader,
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
  { id: 'INDIVIDUAL', label: 'Individual Stall', widthM: 2, depthM: 2, approxSize: '4' },
  { id: 'GROUP', label: 'Group Stall', widthM: 6, depthM: 4, approxSize: '24' },
  { id: 'GALLERY', label: 'Gallery Space', widthM: 10, depthM: 8, approxSize: '80' },
] as const
const stallSlugCategories: Record<string, 'INDIVIDUAL' | 'GROUP' | 'GALLERY'> = {
  compact: 'INDIVIDUAL',
  standard: 'INDIVIDUAL',
  group: 'GROUP',
  gallery: 'GALLERY',
}
const stallSlugSizes: Record<string, string> = { compact: '4', standard: '9', group: '24', gallery: '80' }

const steps = ['Personal Details', 'Artwork Details', 'Preferences', 'Select Stall', 'Review'] as const

type Pictures = { id: string; file: File; previewUrl: string }[]
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6

export function BookingWizard({ exhibitions, initialUser, heroImage, initialStall }: {
  exhibitions: Exhibition[]
  initialUser: BookingUser | null
  heroImage: { src: string; alt: string }
  initialStall: string
}) {
  const [user, setUser] = useState(initialUser)
  const [step, setStep] = useState<Step>(0)
  const [city, setCity] = useState('All')
  const [eventIds, setEventIds] = useState<string[]>([])
  const [selectedState, setSelectedState] = useState('')
  const [personal, setPersonal] = useState({ firstName: '', lastName: '', phone: '', address: '' })
  const [art, setArt] = useState({ artForm: '', fasciaName: '', bio: '', websiteUrl: '', instagramUrl: '' })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileAutoFilled, setProfileAutoFilled] = useState(false)
  const [profileLoadError, setProfileLoadError] = useState('')
  const [profileSaveError, setProfileSaveError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [prefs, setPrefs] = useState({
    spaceCategory: stallSlugCategories[initialStall] ?? '',
    stallTypeId: '',
    approxSize: stallSlugSizes[initialStall] ?? '',
    requirements: '',
  })
  const [pictures, setPictures] = useState<Pictures>([])
  const [portfolio, setPortfolio] = useState<File | null>(null)
  const [stalls, setStalls] = useState<Stall[]>([])
  const [cityStallTypes, setCityStallTypes] = useState<StallType[]>([])
  const [cityStallTypesLoading, setCityStallTypesLoading] = useState(false)
  const [cityStallTypesError, setCityStallTypesError] = useState('')
  const [stallsLoading, setStallsLoading] = useState(false)
  const [stallsError, setStallsError] = useState('')
  const [stallId, setStallId] = useState('')
  const [stallHold, setStallHold] = useState<{ id: string; eventId: string; stallId: string; expiresAt: string } | null>(null)
  const [stallHoldBusy, setStallHoldBusy] = useState(false)
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
  const exhibitionStates = useMemo(
    () => (exhibition?.state ?? '').split(/[,;/]/).map((state) => state.trim()).filter(Boolean),
    [exhibition?.state],
  )
  const cities = useMemo(() => [...new Set(exhibitions.map((entry) => entry.city).filter(Boolean))].sort(), [exhibitions])
  const visible = city === 'All' ? exhibitions : exhibitions.filter((entry) => entry.city === city)
  const stall = stalls.find((entry) => entry.id === stallId) ?? null
  const preferredType = cityStallTypes.find((entry) => entry.id === prefs.stallTypeId) ?? null

  function chooseSpaceOption(option: (typeof spaceOptions)[number]) {
    const matchingType = cityStallTypes.find((type) =>
      type.category === option.id && Number(type.widthM) === option.widthM && Number(type.depthM) === option.depthM,
    ) ?? cityStallTypes.find((type) => type.category === option.id)
    setPrefs((current) => ({
      ...current,
      spaceCategory: option.id,
      stallTypeId: matchingType?.id ?? '',
      approxSize: option.approxSize,
    }))
    setErrors((current) => {
      const next = { ...current }
      delete next.spaceCategory
      return next
    })
  }

  const loadMine = useCallback(async () => {
    if (!user) { setMine(null); return }
    try { setMine(await getMine()) } catch { setMine(null) }
  }, [user])

  async function releaseSelectedStall() {
    if (!stallHold) {
      setStallId('')
      return true
    }
    setStallHoldBusy(true)
    try {
      await releaseStallHold(stallHold.eventId, stallHold.stallId)
      setStallHold(null)
      setStallId('')
      return true
    } catch (cause) {
      setStallsError(cause instanceof Error ? cause.message : 'The temporary stall lock could not be released.')
      return false
    } finally {
      setStallHoldBusy(false)
    }
  }

  async function selectStall(id: string) {
    if (!id) {
      await releaseSelectedStall()
      return
    }
    if (!user || !eventId) {
      setStallsError('Sign in with your verified email to temporarily lock a stall.')
      return
    }
    setStallHoldBusy(true)
    setStallsError('')
    try {
      const hold = await holdStall(eventId, id)
      setStallHold({ ...hold, eventId, stallId: id })
      setStallId(id)
      try {
        setStalls(await getStalls(eventId, selectedState))
      } catch (cause) {
        setStallsError(cause instanceof Error ? cause.message : 'The latest stall availability could not be refreshed.')
      }
    } catch (cause) {
      setStallsError(cause instanceof Error ? cause.message : 'This stall could not be temporarily reserved.')
    } finally {
      setStallHoldBusy(false)
    }
  }

  useEffect(() => { void loadMine() }, [loadMine])

  useEffect(() => {
    const firstState = (exhibition?.state ?? '').split(/[,;/]/).map((state) => state.trim()).find(Boolean) ?? ''
    setSelectedState(firstState)
    setStallId('')
    setPrefs((current) => ({ ...current, stallTypeId: '' }))
  }, [eventId, exhibition?.state])

  useEffect(() => {
    if (!eventId) {
      setCityStallTypes([])
      setCityStallTypesError('')
      setCityStallTypesLoading(false)
      return
    }
    let cancelled = false
    setCityStallTypes([])
    setCityStallTypesLoading(true)
    setCityStallTypesError('')
    getEventStallTypes(eventId, selectedState)
      .then((types) => { if (!cancelled) setCityStallTypes(types) })
      .catch((cause: unknown) => {
        if (!cancelled) setCityStallTypesError(cause instanceof Error ? cause.message : 'City-specific stall tariffs could not be loaded.')
      })
      .finally(() => { if (!cancelled) setCityStallTypesLoading(false) })
    return () => { cancelled = true }
  }, [eventId, selectedState])

  useEffect(() => {
    if (!initialStall) return
    const preferred = cityStallTypes.find((type) => type.code.toLowerCase() === initialStall)
    if (!preferred) return
    setPrefs((current) => ({
      ...current,
      spaceCategory: preferred.category,
      stallTypeId: preferred.id,
      approxSize: stallSlugSizes[initialStall] ?? current.approxSize,
    }))
  }, [cityStallTypes, initialStall])

  useEffect(() => {
    if (!eventId) {
      setStalls([])
      setStallsLoading(false)
      setStallsError('')
      return
    }
    let cancelled = false
    setStalls([])
    setStallsLoading(true)
    setStallsError('')
    getStalls(eventId, selectedState)
      .then((rows) => { if (!cancelled) setStalls(rows) })
      .catch((cause: unknown) => {
        if (!cancelled) setStallsError(cause instanceof Error ? cause.message : 'Floor plan data could not be loaded.')
      })
      .finally(() => { if (!cancelled) setStallsLoading(false) })
    return () => { cancelled = true }
  }, [eventId, selectedState])

  useEffect(() => {
    if (!user || !eventId) {
      setProfileLoading(false)
      setProfileAutoFilled(false)
      if (!user) {
        setPersonal({ firstName: '', lastName: '', phone: '', address: '' })
        setArt((current) => ({ ...current, websiteUrl: '', instagramUrl: '' }))
      }
      return
    }

    let cancelled = false
    setProfileLoading(true)
    setProfileAutoFilled(false)
    setProfileLoadError('')
    bookingApi<BookingProfile>('/api/bookings/profile')
      .then((profile) => {
        if (cancelled) return
        setPersonal({
          firstName: profile.firstName ?? '',
          lastName: profile.lastName ?? '',
          phone: profile.phone ?? '',
          address: profile.address ?? '',
        })
        setArt((current) => ({
          ...current,
          websiteUrl: profile.websiteUrl ?? '',
          instagramUrl: profile.instagramUrl ?? '',
        }))
        setProfileAutoFilled(
          [profile.firstName, profile.lastName, profile.phone, profile.email, profile.address]
            .every((value) => typeof value === 'string' && value.trim().length > 0),
        )
      })
      .catch((cause: unknown) => {
        if (!cancelled) setProfileLoadError(cause instanceof Error ? cause.message : 'Could not load your saved exhibitor profile.')
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false)
      })
    return () => { cancelled = true }
  }, [eventId, user])

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
      if (personal.lastName.trim().length < 1) next.lastName = 'Enter your last name.'
      if (!/^[0-9+()\s-]{6,30}$/.test(personal.phone.trim())) next.phone = 'Enter a valid phone number.'
      if (personal.address.trim().length < 6) next.address = 'Enter your complete address.'
      if (art.websiteUrl && !isUrl(art.websiteUrl)) next.websiteUrl = 'Use a full web address, e.g. https://yourstudio.com'
      if (art.instagramUrl && !isUrl(art.instagramUrl)) next.instagramUrl = 'Use a full profile link, e.g. https://instagram.com/yourhandle'
    }
    if (target > 2) {
      if (!art.artForm) next.artForm = 'Choose your art form.'
      const plain = art.bio.replace(/<[^>]*>/g, '').trim()
      if (plain.length < 20) next.bio = 'Tell us about your artwork in at least 20 characters.'
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

  async function saveProfileAndContinue() {
    if (!validateStep(2) || !user) return
    setProfileSaving(true)
    setProfileSaveError('')
    try {
      const saved = await bookingApi<BookingProfile>('/api/bookings/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          firstName: personal.firstName.trim(),
          lastName: personal.lastName.trim(),
          phone: personal.phone.trim(),
          address: personal.address.trim(),
          websiteUrl: normaliseUrl(art.websiteUrl) ?? '',
          instagramUrl: normaliseUrl(art.instagramUrl) ?? '',
        }),
      })
      setProfileLoadError('')
      setProfileAutoFilled(
        [saved.firstName, saved.lastName, saved.phone, saved.email, saved.address]
          .every((value) => typeof value === 'string' && value.trim().length > 0),
      )
      go(2)
    } catch (cause: unknown) {
      setProfileSaveError(cause instanceof Error ? cause.message : 'Your details could not be saved. Please try again.')
    } finally {
      setProfileSaving(false)
    }
  }

  function go(target: Step) {
    if (target < step && step === 4 && stallHold) {
      void (async () => {
        if (await releaseSelectedStall()) setStep(target)
      })()
      return
    }
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
      const activeHold = stallId ? await holdStall(eventId, stallId) : null
      if (activeHold) setStallHold({ ...activeHold, eventId, stallId })
      const payload = {
        firstName: personal.firstName.trim(), lastName: personal.lastName.trim(), phone: personal.phone.trim(),
        address: personal.address.trim(), websiteUrl: normaliseUrl(art.websiteUrl), instagramUrl: normaliseUrl(art.instagramUrl),
        artForm: art.artForm, fasciaName: art.fasciaName.trim(), bio: art.bio,
        spaceCategory: prefs.spaceCategory as 'INDIVIDUAL' | 'GROUP' | 'GALLERY',
        preferredStallTypeId: prefs.stallTypeId || null,
        requestedStallId: stallId || null,
        stallHoldId: activeHold?.id ?? null,
        approxSizeSqm: prefs.approxSize ? Number(prefs.approxSize) : null,
        specialRequirements: prefs.requirements.trim(),
        artworkAssetIds, portfolioAssetId, agreeTerms: true,
      }
      const applied = await bookingApi<{ id: string; applicationRef: string; status: MineApplication['status'] }>(
        '/api/bookings/applications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload, eventId }) },
      )
      setStallHold(null)
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
                void (async () => {
                  if (!(await releaseSelectedStall())) return
                  if (eventIds[0] === id) {
                    setEventIds([])
                    setStallId('')
                    return
                  }
                  setEventIds([id])
                  setStallId('')
                  setErrors({})
                  setStep(1)
                })()
              }} />
            {errors.eventIds && <p className="bw-field-error" role="alert">{errors.eventIds}</p>}
          </section>
        </>
      )}

      {step > 0 && (
        <section className="bw-wizard" ref={wizardRef}>
          <div className="bw-head">
            <button className="bw-change-event" type="button" onClick={() => {
              void (async () => {
                if (!(await releaseSelectedStall())) return
                setEventIds([])
                setStallId('')
                setErrors({})
                setStep(0)
              })()
            }}>
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
                : <SignInPanel busy={busy} error={authError} onSuccess={() => undefined}
                  onModeChange={() => wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  onSignIn={signIn} onRegister={register} />)}
              {user && (
                <>
                  {profileLoading && <p className="bw-profile-note" role="status">Looking for your saved exhibitor details…</p>}
                  {profileAutoFilled && <p className="bw-profile-autofill" role="status">Personal details auto-filled from your exhibitor profile ✓</p>}
                  {profileLoadError && <p className="bw-field-error" role="alert">Your saved profile could not be loaded: {profileLoadError} You can review or enter your details below.</p>}
                  <div className="bw-row">
                    <Field label="First Name" required error={errors.firstName}>
                      <input value={personal.firstName} maxLength={80} autoComplete="given-name" placeholder="Enter your first name" disabled={profileLoading}
                        onChange={(event) => setPersonal({ ...personal, firstName: event.target.value })} />
                    </Field>
                    <Field label="Last Name" required error={errors.lastName}>
                      <input value={personal.lastName} maxLength={80} autoComplete="family-name" placeholder="Enter your last name" disabled={profileLoading}
                        onChange={(event) => setPersonal({ ...personal, lastName: event.target.value })} />
                    </Field>
                  </div>
                  <Field label="Phone Number" required error={errors.phone}>
                    <div className="bw-phone">
                      <span className="bw-dial" aria-hidden="true">IN +91</span>
                      <input value={personal.phone} maxLength={30} inputMode="tel" autoComplete="tel" placeholder="Enter phone number" disabled={profileLoading}
                        onChange={(event) => setPersonal({ ...personal, phone: event.target.value })} />
                    </div>
                  </Field>
                  <Field label="Email Address" required>
                    <div className="bw-locked">
                      <input value={userEmail(user)} readOnly aria-readonly="true" />
                      <span className="bw-verified-badge">Verified ✓</span>
                    </div>
                    <small className="bw-locked-note">Linked to your signed-in exhibitor account</small>
                  </Field>
                  <Field label="Address" required error={errors.address}>
                    <textarea rows={3} value={personal.address} maxLength={500} placeholder="Enter your complete address" disabled={profileLoading}
                      onChange={(event) => setPersonal({ ...personal, address: event.target.value })} />
                  </Field>
                  <div className="bw-row">
                    <Field label="Website" error={errors.websiteUrl}>
                      <input value={art.websiteUrl} maxLength={500} placeholder="https://" disabled={profileLoading} onChange={(event) => setArt({ ...art, websiteUrl: event.target.value })} />
                    </Field>
                    <Field label="Instagram ID" error={errors.instagramUrl}>
                      <input value={art.instagramUrl} maxLength={500} placeholder="https://instagram.com/yourhandle" disabled={profileLoading} onChange={(event) => setArt({ ...art, instagramUrl: event.target.value })} />
                    </Field>
                  </div>
                  {profileSaveError && <p className="bw-field-error" role="alert">Your details could not be saved: {profileSaveError}</p>}
                  <div className="bw-actions">
                    <button className="bw-btn-ghost" type="button" onClick={signOut}>Sign out</button>
                    <button className="bw-btn-primary" type="button" disabled={profileLoading || profileSaving} onClick={saveProfileAndContinue}>
                      {profileSaving ? 'Saving…' : 'Save & Continue →'}
                    </button>
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
                <span className="bw-label">Selected Exhibition</span>
                <div className="bw-selected-exhibition">
                  <div className="bw-selected-exhibition-copy">
                    <strong>{exhibition?.title ?? 'No exhibition selected'}</strong>
                    {exhibition && <span>{formatEventDates(exhibition.startsAt, exhibition.endsAt)}</span>}
                  </div>
                  <div className="bw-selected-exhibition-actions">
                    {exhibition && <span className="bw-selected-badge">Selected ✓</span>}
                    <button className="bw-linkbtn" type="button" onClick={() => {
                      void (async () => {
                        if (!(await releaseSelectedStall())) return
                        setEventIds([])
                        setErrors({})
                        setStep(0)
                      })()
                    }}>Change exhibition</button>
                  </div>
                </div>
                {errors.eventIds && <p className="bw-field-error" role="alert">{errors.eventIds}</p>}
              </div>
              {exhibitionStates.length > 1 ? (
                <Field label="Choose the state for your stall" required>
                  <select value={selectedState} onChange={(event) => {
                    const state = event.target.value
                    void (async () => {
                      if (!(await releaseSelectedStall())) return
                      setSelectedState(state)
                      setPrefs((current) => ({ ...current, stallTypeId: '' }))
                    })()
                  }}>
                    {exhibitionStates.map((state) => <option key={state} value={state}>{state}</option>)}
                  </select>
                </Field>
              ) : selectedState ? (
                <p className="bw-hint">State-specific stall options for <strong>{selectedState}</strong>.</p>
              ) : null}
              <div className="bw-field">
                <span className="bw-label">Space size looking for <em>*</em></span>
                <div className="bw-spaces">
                  {spaceOptions.map((option) => (
                    <label key={option.id} className={`bw-space ${prefs.spaceCategory === option.id ? 'is-active' : ''}`}>
                      <input type="radio" name="bw-space" value={option.id} checked={prefs.spaceCategory === option.id}
                        onChange={() => chooseSpaceOption(option)} />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                {errors.spaceCategory && <p className="bw-field-error" role="alert">{errors.spaceCategory}</p>}
              </div>
              <Field label="Preferred Stall Type">
                <select value={prefs.stallTypeId} onChange={(event) => setPrefs({ ...prefs, stallTypeId: event.target.value })}>
                  <option value="">Select stall type</option>
                  {cityStallTypes.filter((type) => !prefs.spaceCategory || type.category === prefs.spaceCategory).map((type) => (
                    <option key={type.id} value={type.id}>{type.name} · {stallSize(type)} · {formatMoney(totalWithTax(Number(type.price), Number(type.taxRate)).total)}</option>
                  ))}
                </select>
              </Field>
              {cityStallTypesLoading && <p className="bw-hint" role="status">Loading live tariffs for {selectedState || exhibition?.city || 'this exhibition'}…</p>}
              {cityStallTypesError && <p className="bw-field-error" role="alert">State-specific tariffs could not be loaded: {cityStallTypesError}</p>}
              {!cityStallTypesLoading && !cityStallTypesError && exhibition && !cityStallTypes.length && (
                <p className="bw-hint" role="status">Stall tariffs for this exhibition have not been published yet. Please contact the Exhibition Admin.</p>
              )}
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
                  {stallsLoading ? (
                    <p className="bw-empty" role="status">Loading this exhibition&apos;s live floor plan…</p>
                  ) : stallsError ? (
                    <p className="bw-field-error" role="alert">The floor plan could not be loaded: {stallsError}</p>
                  ) : stalls.length > 0 ? (
                    <>
                      <StallMap stalls={stalls} selectedId={stallId} onSelect={(id) => { void selectStall(id) }}
                        preferredCategory={spaceOptions.find((option) => option.id === prefs.spaceCategory)?.id}
                        coverUrl={exhibition.media[0] ? `${apiBaseUrl}${exhibition.media[0].url}` : undefined} coverAlt={exhibition.title} />
                      <p className="bw-hint">A selected stall is locked for 10 minutes while you finish. It is an application request, not a final allocation; availability is checked again after approval.</p>
                      {stallHold && stallHold.stallId === stallId && (
                        <p className="bw-profile-note" role="status">
                          Temporarily locked until {new Date(stallHold.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. This is a request only; final allocation follows approval and booking.
                        </p>
                      )}
                      {stallHoldBusy && <p className="bw-profile-note" role="status">Updating your 10-minute stall lock…</p>}
                    </>
                  ) : (
                    <div className="bw-priority-allocation">
                      <span className="bw-priority-eyebrow">PERSONAL STALL PLACEMENT</span>
                      <h3>Priority Allocation</h3>
                      <p>This exhibition is preparing its live floor plan. Continue your application and our team will help place you in the right space.</p>
                      <button className="bw-btn-primary" type="button" onClick={() => go(5)}>Proceed to Review →</button>
                    </div>
                  )}
                  <div className="bw-actions">
                    <button className="bw-btn-ghost" type="button" onClick={() => {
                      void (async () => {
                        if (await releaseSelectedStall()) setStep(3)
                      })()
                    }}>← Back</button>
                    {!stallsLoading && !stallsError && stalls.length > 0 && (
                      <button className="bw-btn-primary" type="button" onClick={() => go(5)}>
                        {stall ? `Confirm Booth ${stall.code} & Review →` : 'Continue without a stall →'}
                      </button>
                    )}
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
                ['Venue', exhibition ? formatVenue(exhibition.venue, exhibition.city) : '—'],
                [stall ? 'Space / Tier' : 'Space', stall?.type.name ?? (prefs.spaceCategory ? categoryLabel(prefs.spaceCategory) : '—')],
                ...(!stall ? [['Preferred Type', preferredType?.name ?? 'Any'] as [string, string]] : []),
                [stall ? 'Booth' : 'Stall', stall ? stall.code : 'Suggest one for me'],
                [stall ? 'Dimensions & Size' : 'Approx. Size', stall ? `${stallSize(stall.type)} (${stallSquareMeters(stall.type)} sq m)` : prefs.approxSize ? `${prefs.approxSize} sq m` : '—'],
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
              <div className="bw-actions bw-review-actions">
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

function formatVenue(venue: string, city: string) {
  const parts = [venue.trim(), city.trim()].filter(Boolean)
  if (parts.length < 2 || parts[0].toLocaleLowerCase().includes(parts[1].toLocaleLowerCase())) return parts[0] ?? '—'
  return parts.join(', ')
}

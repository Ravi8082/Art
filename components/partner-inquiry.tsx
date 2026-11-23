'use client'

import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const partnershipTypes = ['Title Sponsor', 'Venue Partner', 'Gallery Collaborator', 'Media Partner'] as const

type PartnerInquiryContextValue = { openPartnerInquiry: () => void }
const PartnerInquiryContext = createContext<PartnerInquiryContextValue | null>(null)

export function PartnerInquiryProvider({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const [reference, setReference] = useState('')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  function openPartnerInquiry() {
    setError('')
    setReference('')
    setIsOpen(true)
  }

  function closePartnerInquiry() {
    setIsOpen(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSending) return
    setIsSending(true)
    setError('')
    const form = event.currentTarget
    const data = new FormData(form)
    const organization = String(data.get('organization') ?? '').trim()
    const contact = String(data.get('contact') ?? '').trim()
    const email = String(data.get('email') ?? '').trim().toLowerCase()
    const phone = String(data.get('phone') ?? '').trim()
    const type = String(data.get('partnershipType') ?? '')
    const message = String(data.get('message') ?? '').trim()

    try {
      const response = await fetch(`${apiBaseUrl}/api/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contact,
          email,
          phone,
          category: 'Partnership',
          subject: `Partner inquiry — ${type}: ${organization}`,
          message: `Organization: ${organization}\nContact person: ${contact}\nPartnership type: ${type}\n\n${message}`,
          consent: data.get('consent') === 'on',
        }),
      })
      const payload = await response.json().catch(() => ({})) as { refCode?: string; error?: string }
      if (!response.ok || !payload.refCode) {
        throw new Error(response.status === 429
          ? 'Too many enquiries right now. Please try again later.'
          : payload.error || 'We could not record your enquiry. Please try again.')
      }
      setReference(payload.refCode)
      form.reset()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not reach the server. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <PartnerInquiryContext.Provider value={{ openPartnerInquiry }}>
      {children}
      <dialog
        ref={dialogRef}
        className="partner-inquiry-dialog"
        aria-labelledby="partner-inquiry-title"
        onCancel={(event) => { event.preventDefault(); closePartnerInquiry() }}
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closePartnerInquiry()
        }}
      >
        <div className="partner-inquiry-panel">
          <button type="button" className="partner-inquiry-close" aria-label="Close partner inquiry" onClick={closePartnerInquiry}>
            <X size={20} />
          </button>
          {reference ? (
            <div className="partner-inquiry-success" role="status">
              <span className="partner-inquiry-eyebrow">Thank you</span>
              <h2 id="partner-inquiry-title">Your partnership enquiry is received.</h2>
              <p>Our team will follow up. Your reference is <strong>{reference}</strong>.</p>
              <button type="button" className="partner-inquiry-submit" onClick={closePartnerInquiry}>Done</button>
            </div>
          ) : (
            <>
              <span className="partner-inquiry-eyebrow">Work with The Haat of Art</span>
              <h2 id="partner-inquiry-title">Become a Partner</h2>
              <p className="partner-inquiry-intro">Tell us about your organization and the kind of cultural partnership you have in mind.</p>
              <form className="partner-inquiry-form" onSubmit={submit}>
                <div className="partner-inquiry-fields">
                  <label>Organization Name<input name="organization" required maxLength={160} autoComplete="organization" /></label>
                  <label>Contact Person<input name="contact" required minLength={2} maxLength={160} autoComplete="name" /></label>
                  <label>Email Address<input name="email" type="email" required maxLength={255} autoComplete="email" /></label>
                  <label>Phone Number <span>(optional)</span><input name="phone" type="tel" maxLength={30} pattern="[0-9+() -]{6,30}" autoComplete="tel" /></label>
                </div>
                <label>Partnership Type
                  <select name="partnershipType" required defaultValue="">
                    <option value="" disabled>Select a partnership type</option>
                    {partnershipTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label>Message<textarea name="message" required minLength={10} maxLength={4000} rows={4} /></label>
                <label className="partner-inquiry-consent">
                  <input type="checkbox" name="consent" required />
                  <span>I agree that The Haat of Art may contact me about this partnership enquiry.</span>
                </label>
                {error && <p className="partner-inquiry-error" role="alert">{error}</p>}
                <button className="partner-inquiry-submit" type="submit" disabled={isSending}>
                  {isSending ? 'Sending…' : 'Send Partnership Enquiry'}
                </button>
              </form>
            </>
          )}
        </div>
      </dialog>
    </PartnerInquiryContext.Provider>
  )
}

export function PartnerInquiryTrigger({ children = 'Become a Partner', className }: { children?: ReactNode; className?: string }) {
  const context = useContext(PartnerInquiryContext)
  if (!context) throw new Error('PartnerInquiryTrigger must be rendered inside PartnerInquiryProvider')
  return <button type="button" className={className} onClick={context.openPartnerInquiry}>{children}</button>
}

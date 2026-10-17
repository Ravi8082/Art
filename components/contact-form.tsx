'use client'

import { useRef, useState, type FormEvent } from 'react'
import { contactEnquiryCategories } from '@/lib/demo-contact'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const attachmentTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
const maxAttachmentBytes = 5 * 1024 * 1024

type FieldErrors = Partial<Record<'name' | 'email' | 'phone' | 'subject' | 'message' | 'consent' | 'attachment', string>>

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')
  const [refCode, setRefCode] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentNotice, setAttachmentNotice] = useState('')
  const sending = useRef(false)

  function validate(form: HTMLFormElement) {
    const data = new FormData(form)
    const next: FieldErrors = {}
    const name = String(data.get('name') ?? '')
    const email = String(data.get('email') ?? '')
    const phone = String(data.get('phone') ?? '')
    const subject = String(data.get('subject') ?? '')
    const message = String(data.get('message') ?? '')
    if (name.trim().length < 2) next.name = 'Please enter your full name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) next.email = 'Please enter a valid email address.'
    if (phone && !/^[0-9+()\s-]{6,30}$/.test(phone.trim())) next.phone = 'Use digits, spaces and + ( ) - only.'
    if (subject.trim().length < 3) next.subject = 'Add a short subject (at least 3 characters).'
    if (message.trim().length < 10) next.message = 'Tell us a little more — at least 10 characters.'
    if (!form.querySelector<HTMLInputElement>('[name=consent]')?.checked) next.consent = 'Please accept the privacy notice.'
    if (attachment && !attachmentTypes.includes(attachment.type)) next.attachment = 'Attachments can be PDF, JPG, PNG, WebP or GIF.'
    else if (attachment && attachment.size > maxAttachmentBytes) next.attachment = 'Attachments must be 5 MB or smaller.'
    return next
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current) return
    const form = event.currentTarget
    const fieldErrors = validate(form)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length) {
      setStatus('error')
      setError('Please correct the highlighted fields.')
      return
    }
    sending.current = true
    setStatus('sending')
    setError('')
    const data = new FormData(form)
    try {
      const response = await fetch(`${apiBaseUrl}/api/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') ?? '').trim(),
          email: String(data.get('email') ?? '').trim().toLowerCase(),
          phone: String(data.get('phone') ?? '').trim(),
          category: String(data.get('category') ?? 'General'),
          subject: String(data.get('subject') ?? '').trim(),
          message: String(data.get('message') ?? '').trim(),
          consent: true,
        }),
      })
      const payload = await response.json().catch(() => ({})) as { ok?: boolean; id?: string; refCode?: string; error?: string }
      if (!response.ok || !payload.refCode) {
        setStatus('error')
        setError(response.status === 429
          ? 'Too many messages from you right now. Please try again later.'
          : payload.error || 'We could not record your enquiry. Please try again.')
        return
      }
      setRefCode(payload.refCode)
      if (attachment && payload.id) {
        setAttachmentNotice('')
        try {
          const upload = await fetch(`${apiBaseUrl}/api/enquiries/${payload.id}/attachment`, {
            method: 'POST',
            headers: { 'Content-Type': attachment.type, 'X-File-Name': encodeURIComponent(attachment.name) },
            body: attachment,
          })
          if (!upload.ok) setAttachmentNotice(((await upload.json().catch(() => ({}))) as { error?: string }).error || 'attachment could not be added')
        } catch {
          setAttachmentNotice('attachment could not be added')
        }
      }
      form.reset()
      setAttachment(null)
      setStatus('sent')
    } catch {
      setStatus('error')
      setError('We could not reach the server. Your enquiry has not been recorded — please try again.')
    } finally {
      sending.current = false
    }
  }

  if (status === 'sent') {
    return (
      <div className="ct-done" role="status">
        <span className="ct-done-mark">✓</span>
        <h3>Message received.</h3>
        <p>Your enquiry reference is <strong>{refCode}</strong>. Quote it in any follow-up — our team replies within two working days.</p>
        {attachmentNotice && <p className="form-error">Your enquiry was saved, but {attachmentNotice}.</p>}
        <button className="public-button dark" onClick={() => { setStatus('idle'); setRefCode('') }}>Send another message</button>
      </div>
    )
  }

  return (
    <form className="contact-form ct-form" onSubmit={submit} noValidate>
      <div className="ct-row">
        <label>Full name<input name="name" maxLength={160} autoComplete="name" aria-invalid={Boolean(errors.name)} /></label>
        <label>Email address<input name="email" type="email" maxLength={255} autoComplete="email" aria-invalid={Boolean(errors.email)} /></label>
      </div>
      {errors.name && <p className="ct-field-error">{errors.name}</p>}
      {errors.email && <p className="ct-field-error">{errors.email}</p>}
      <div className="ct-row">
        <label>Mobile number <small>optional</small><input name="phone" maxLength={30} inputMode="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} /></label>
        <label>Enquiry category
          <select name="category" defaultValue="General">
            {contactEnquiryCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
      </div>
      {errors.phone && <p className="ct-field-error">{errors.phone}</p>}
      <label>Subject<input name="subject" maxLength={200} aria-invalid={Boolean(errors.subject)} /></label>
      {errors.subject && <p className="ct-field-error">{errors.subject}</p>}
      <label>Message<textarea name="message" minLength={10} maxLength={5000} rows={6} aria-invalid={Boolean(errors.message)} /></label>
      {errors.message && <p className="ct-field-error">{errors.message}</p>}
      <label className="ct-file">Attachment <small>PDF, JPG, PNG · max 5 MB · optional</small>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*" onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null
          setAttachment(file)
          setErrors((current) => ({ ...current, attachment: undefined }))
        }} />
      </label>
      {errors.attachment && <p className="ct-field-error">{errors.attachment}</p>}
      <label className="ct-consent">
        <input type="checkbox" name="consent" />
        <span>I agree that The Haat of Art may contact me about this enquiry. <em>Privacy notice.</em></span>
      </label>
      {errors.consent && <p className="ct-field-error">{errors.consent}</p>}
      <button className="public-button dark" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send message'}</button>
      {status === 'error' && error && <p className="form-error" role="alert">{error}</p>}
    </form>
  )
}

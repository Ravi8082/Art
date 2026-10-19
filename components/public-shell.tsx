'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUp, Clock, Menu, Search, X, MapPin, Phone, Mail } from 'lucide-react'
import { demoPartners } from '@/lib/demo-home-content'
import { useSiteSettings } from '@/components/site-settings-provider'

const whatsappMessage = 'Hello The Haat of Art team! I would like to know more about your exhibitions, stall booking and visitor passes. Please share the details. Thank you!'
const partnerStyle = (name: string) => demoPartners.find((p) => p.name === name)?.style ?? 'custom'
const isExternal = (href: string) => /^(https?:|mailto:|tel:)/.test(href)

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export function PublicShell({ children, logoUrl = '/media/logo.png', logoAlt = 'The Haat of Art', footerVariant = 'default' }: {
  children: ReactNode
  logoUrl?: string
  logoAlt?: string
  footerLocations?: string
  footerVariant?: 'default' | 'highlights'
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const pathname = usePathname()
  const { navbar, footer } = useSiteSettings()
  const whatsappUrl = `https://wa.me/${footer.whatsapp}?text=${encodeURIComponent(whatsappMessage)}`
  const socials = footer.social
  const soc = (key: keyof typeof socials) => socials[key] || '/contact'
  async function subscribe(event: FormEvent) {
    event.preventDefault()
    setSubscribing(true)
    setStatus('Subscribing...')
    try {
      const res = await fetch(`${apiBase}/api/newsletter/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      if (!res.ok) {
        const result = await res.json().catch(() => null)
        throw new Error(typeof result?.error === 'string' ? result.error : 'Could not subscribe right now. Please try again.')
      }
      setEmail('')
      const result = await res.json()
      const confirmation = result.confirmationEmail
      setStatus(confirmation === 'failed' || confirmation === 'not_configured'
        ? 'Thank you for subscribing! We could not send the confirmation email right now.'
        : typeof result.message === 'string' ? result.message : 'Thank you for subscribing!')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not subscribe right now. Please try again.')
    } finally {
      setSubscribing(false)
    }
  }
  return (
    <main className="public-site">
      <header className="public-header">
        <Link className="public-logo" href="/" aria-label="The Haat of Art home">{logoUrl ? <img src={logoUrl} alt={logoAlt} /> : <span>H</span>}</Link>
        <nav className={open ? 'public-nav is-open' : 'public-nav'} aria-label="Main navigation">
          {navbar.links.filter((l) => l.visible).map(({ label, href, highlight }) => {
            const route = href.split('#')[0]
            const isCurrent = !isExternal(href) && route !== '' && (route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`))
            const cls = highlight ? 'nav-registration' : undefined
            return isExternal(href)
              ? <a href={href} key={label + href} className={cls} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>{label}</a>
              : <Link href={href} key={label + href} className={cls} aria-current={isCurrent ? 'page' : undefined} onClick={() => setOpen(false)}>{label}</Link>
          })}
          {navbar.showSearch && <Link className="public-search" href="/gallery" aria-label="Search the gallery"><Search size={17} /></Link>}
        </nav>
        <button className="public-menu" onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      </header>
      {children}
      <footer className="th-footer" id="contact">
        <section className="thf-news" aria-label="Newsletter">
          <div className="thf-news-copy">
            <h3>{footer.newsletterTitle}</h3>
            <p>{footer.newsletterText}</p>
          </div>
          <form className="thf-news-form" onSubmit={subscribe}>
            <label><Mail size={18} /><input type="email" required placeholder="Enter your email address" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <button type="submit" disabled={subscribing}>{subscribing ? 'Subscribing…' : 'Subscribe'}</button>
            <small role="status" aria-live="polite">{status || 'We respect your privacy. Unsubscribe anytime.'}</small>
          </form>
          <div className="thf-news-photo" aria-hidden="true" />
        </section>
        <div className="thf-main">
          <div className="thf-brand">
            <Link className="public-logo" href="/" aria-label="The Haat of Art home">{logoUrl ? <img src={logoUrl} alt={logoAlt} /> : <span>H</span>}</Link>
            <p>{footer.about}</p>
            <div className="thf-social">
              <a href={soc('facebook')} aria-label="Facebook" className="fb"><b>f</b></a>
              <a href={soc('instagram')} aria-label="Instagram" className="ig"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg></a>
              <a href={soc('youtube')} aria-label="YouTube" className="yt"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 7l8 5-8 5z" /></svg></a>
              <a href={soc('linkedin')} aria-label="LinkedIn" className="in"><b>in</b></a>
              <a href={soc('x')} aria-label="X" className="xx"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L1.9 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.3 4.7H5.5l11.2 14.5Z" /></svg></a>
            </div>
            <div className="thf-tag">            <span className="thf-script">{footer.script}</span><span className="thf-sub">{footer.scriptSub}</span></div>
                      </div>
                      {footer.columns.map((col) => (
                        <nav className="thf-col" aria-label={col.title} key={col.title}>
                          <h4>{col.title}</h4>
                          {col.links.map(({ label, href }) => isExternal(href)
                            ? <a key={label + href} href={href} target="_blank" rel="noreferrer">{label}</a>
                            : <Link key={label + href} href={href}>{label}</Link>)}
                        </nav>
                      ))}
          <div className="thf-col thf-contact">
            <h4>Contact Us</h4>
            <span><MapPin size={20} /><span><b>The Haat of Art Foundation</b>            {footer.address}</span></span>
                        <span><Phone size={20} /><span>{footer.phone}</span></span>
                        <span><Mail size={20} /><span>{footer.email}</span></span>
                        <span><Clock size={20} /><span>{footer.hours}</span></span>
            <div className="thf-art" aria-hidden="true"><i /><i /></div>
          </div>
        </div>
        <div className="thf-bar">
          <span className="thf-ptitle">{footer.partnersTitle}</span>
          <div className="thf-partners">
            {footer.partners.map((name) => <span key={name} className={`thf-p thf-p-${partnerStyle(name)}`}>{name}</span>)}
          </div>
          <span className="thf-copy">{footer.copyright.split('\n').map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</span>
          <button type="button" className="thf-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp size={20} /></button>
        </div>
      </footer>
      <a className="wa-btn" href={whatsappUrl} target="_blank" rel="noreferrer" aria-label="Chat with us on WhatsApp" title="Chat with us on WhatsApp">
        <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" fill="currentColor"><path d="M16.04 3C9.4 3 4 8.38 4 15c0 2.12.56 4.18 1.6 6L4 29l8.2-1.56A12 12 0 0 0 16.04 28C22.68 28 28 22.62 28 16S22.68 3 16.04 3Zm0 21.9c-1.8 0-3.56-.5-5.1-1.4l-.36-.22-4.86.92.96-4.7-.24-.38A9.9 9.9 0 0 1 6.1 15c0-5.46 4.46-9.9 9.94-9.9 5.5 0 9.9 4.44 9.9 9.9s-4.4 9.9-9.9 9.9Zm5.44-7.4c-.3-.14-1.76-.86-2.04-.96-.26-.1-.46-.14-.66.14-.2.3-.76.96-.94 1.16-.16.2-.34.22-.64.08-1.76-.88-2.9-1.58-4.06-3.56-.3-.52.3-.48.88-1.62.1-.2.04-.36-.02-.5-.08-.14-.66-1.6-.9-2.18-.24-.58-.48-.5-.66-.5h-.56c-.2 0-.5.08-.76.36-.26.3-1 .98-1 2.4s1.02 2.78 1.16 2.98c.14.2 2.02 3.08 4.9 4.32 1.82.78 2.54.84 3.46.7.56-.08 1.76-.72 2-1.42.24-.7.24-1.3.18-1.42-.08-.12-.28-.2-.58-.34Z"/></svg>
      </a>
    </main>
  )
}

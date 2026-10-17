'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Search, X, MapPin, Phone, Mail } from 'lucide-react'
import { demoFooter } from '@/lib/demo-home-content'

const links = [
  ['Home', '/'], ['About', '/about'], ['Exhibitions', '/exhibitions'], ['Indore', '/indore'], ['Highlights', '/highlights'], ['Gallery', '/gallery'],
  ['Artists', '/artists'], ['Partners', '/#partners'], ['Blogs', '/blog'], ['Contact', '/contact'],
] as const

const navLinks = [
  ['Home', '/'], ['About', '/about'], ['Exhibitions', '/exhibitions'], ['Visitor Pass', '/indore#register'], ['Highlights', '/highlights'], ['Gallery', '/gallery'],
  ['Artists', '/artists'], ['Blogs', '/blog'], ['Contact', '/contact'], ['Registration', '/artist/register'],
] as const

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
          {navLinks.map(([label, href]) => {
            const route = href.split('#')[0]
            const isCurrent = route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`)
            return <Link href={href} key={href} className={href === '/artist/register' ? 'nav-registration' : undefined} aria-current={isCurrent ? 'page' : undefined} onClick={() => setOpen(false)}>{label}</Link>
          })}
          <Link className="public-search" href="/gallery" aria-label="Search the gallery"><Search size={17} /></Link>
        </nav>
        <button className="public-menu" onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      </header>
      {children}
      <footer className={footerVariant === 'highlights' ? 'public-footer is-highlights' : 'public-footer'} id="contact">
        <div className="footer-brand">
          <Link className="public-logo" href="/">{logoUrl ? <img src={logoUrl} alt={logoAlt} /> : <span>H</span>}</Link>
          <p>{demoFooter.tagline}</p>
        </div>
        <div className="footer-col">
          <h4>Quick Links</h4>
          {links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </div>
        <div className="footer-col">
          <h4>{footerVariant === 'highlights' ? 'Office Address' : 'Contact Us'}</h4>
          <span><MapPin size={12} /> {demoFooter.contact.address}</span>
          <span><Phone size={12} /> {demoFooter.contact.phone}</span>
          <span><Mail size={12} /> {demoFooter.contact.email}</span>
        </div>
        <div className="footer-col">
          <h4>Follow Us</h4>
          <div className="footer-social">
            <a href="/contact" aria-label="Facebook" className="fb"><b>f</b></a>
            <a href="/contact" aria-label="Instagram" className="ig"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg></a>
            <a href="/contact" aria-label="YouTube" className="yt"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 7l8 5-8 5z" /></svg></a>
            <a href="/contact" aria-label="LinkedIn" className="in"><b>in</b></a>
          </div>
        </div>
        {footerVariant === 'highlights' ? (
          <div className="footer-col footer-partner">
            <h4>Marketing Partner</h4>
            <span className="partner-badge" title="Demo placeholder logo">K3</span>
          </div>
        ) : (
          <form className="footer-news" onSubmit={subscribe}>
            <h4>Subscribe to Our Newsletter</h4>
            <span>Get latest updates on exhibitions, artists and events.</span>
            <div><input type="email" required placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} /><button type="submit" disabled={subscribing}>{subscribing ? 'Subscribing…' : 'Subscribe'}</button></div>
            {status && <small role="status" aria-live="polite">{status}</small>}
          </form>
        )}
        <div className="footer-meta">
          <span>© 2026 The Haat of Art. All rights reserved.</span>
          <span><Link href="/contact">Privacy Policy</Link> &nbsp;|&nbsp; <Link href="/contact">Terms &amp; Conditions</Link></span>
          <span>Designed with <b>♥</b> for the Art Community</span>
        </div>
      </footer>
      {footerVariant === 'highlights' && <a className="wa-btn" href="https://wa.me/917304645333" target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp">WhatsApp</a>}
    </main>
  )
}

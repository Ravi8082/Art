'use client'

import { createContext, Fragment, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUp, Clock, Mail, MapPin, Menu, Phone, Search, TicketCheck, UserRound, X } from 'lucide-react'
import { useSiteSettings } from '@/components/site-settings-provider'
import { MagneticLink } from '@/components/motion/magnetic-link'
import { PartnerInquiryProvider, PartnerInquiryTrigger } from '@/components/partner-inquiry'
import { WelcomeExperience } from '@/components/home/welcome-experience'

const whatsappMessage = 'Hi, I would like to enquire about stall booking / visitor passes for The Haat of Art.'
const isExternal = (href: string) => /^(https?:|mailto:|tel:)/i.test(href)
const externalLinkProps = (href: string) => /^https?:\/\//i.test(href)
  ? { target: '_blank' as const, rel: 'noopener noreferrer' }
  : {}
const homepageNavigation = [
  { href: '/', label: 'Home' },
  { href: '/exhibitions', label: 'Exhibitions' },
  { href: '/event-flow', label: 'Event Flow' },
  { href: '/artists', label: 'Artists' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact Us' },
] as const
const legalDestinations: Record<string, string> = {
  'Privacy Policy': '/privacy-policy',
  'Terms & Conditions': '/terms-and-conditions',
}
const legalHref = (label: string, href: string) => legalDestinations[label] ?? href
const socialHref = (value: string) => /^https?:\/\/\S+$/i.test(value.trim()) ? value.trim() : null

function formatFooterPhones(value: string) {
  return value.split(/[|·,;\r\n]+/).map((phone) => phone.trim()).filter(Boolean).map((phone) => {
    const digits = phone.replace(/\D/g, '')
    const nationalNumber = digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 10 ? digits : null
    return nationalNumber
      ? `+91 ${nationalNumber.slice(0, 5)} ${nationalNumber.slice(5)}`
      : phone
  })
}

type SocialNetwork = 'facebook' | 'instagram' | 'youtube' | 'linkedin' | 'x'

function SocialIcon({ network, label }: { network: SocialNetwork; label: string }) {
  const shared = { width: 20, height: 20, viewBox: '0 0 24 24', role: 'img' as const, 'aria-label': label }
  if (network === 'facebook') return <svg {...shared} fill="currentColor"><path d="M13.5 21v-8.25h2.77l.42-3.21H13.5V7.49c0-.93.26-1.56 1.6-1.56h1.7V3.06C15.98 2.99 15.15 3 14.29 3c-2.56 0-4.31 1.56-4.31 4.42v2.12H7.1v3.21h2.88V21h3.52Z" /></svg>
  if (network === 'instagram') return <svg {...shared} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></svg>
  if (network === 'youtube') return <svg {...shared} fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" transform="translate(.25 .4) scale(.98)" /></svg>
  if (network === 'linkedin') return <svg {...shared} fill="currentColor"><path d="M5.2 3a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4ZM3.3 9h3.8v12H3.3V9Zm6.1 0H13v1.6h.1c.5-.9 1.7-1.9 3.5-1.9 3.8 0 4.5 2.4 4.5 5.5V21h-3.8v-6c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1V21H9.4V9Z" /></svg>
  if (network === 'x') return <svg {...shared} fill="currentColor"><path d="M18.9 2H22l-6.78 7.75L23.2 22h-6.25l-4.9-7.1L5.84 22H2.7l7.25-8.28L2.2 2h6.4l4.43 6.57L18.9 2Zm-1.1 18h1.73L7.68 3.88H5.82L17.8 20Z" /></svg>
}

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type PublicShellProps = {
  children: ReactNode
  logoUrl?: string
  logoAlt?: string
  homepage?: boolean
  homeChrome?: boolean
  footerLocations?: string
  footerVariant?: 'default' | 'highlights'
}

const PublicShellContext = createContext(false)

export function PublicShell(props: PublicShellProps) {
  const nested = useContext(PublicShellContext)
  return nested ? <>{props.children}</> : <PublicShellFrame {...props} />
}

function PublicShellFrame({ children, logoUrl = '/media/logo.png', logoAlt = 'The Haat of Art', homepage = false, footerLocations, footerVariant = 'default' }: PublicShellProps) {
  const publicSiteRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerCloseRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const pathname = usePathname()
  const NewsletterHeading = homepage || pathname === '/artists' || pathname === '/gallery' || pathname === '/contact' ? 'h2' : 'h3'
  const [heroVisible, setHeroVisible] = useState(false)
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerCloseRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
      menuButtonRef.current?.focus()
    }
  }, [open])
  useEffect(() => {
    if (!homepage) {
      setHeroVisible(false)
      return
    }

    const hero = document.getElementById('top')
    if (!hero) {
      setHeroVisible(false)
      return
    }

    const updateVisibility = () => {
      const bounds = hero.getBoundingClientRect()
      setHeroVisible(bounds.bottom > 0 && bounds.top < window.innerHeight)
    }
    updateVisibility()

    const observer = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting))
    observer.observe(hero)
    return () => observer.disconnect()
  }, [homepage, pathname])
  useEffect(() => {
    const root = publicSiteRef.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const trackPointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--spotlight-x', `${event.clientX}px`)
        root.style.setProperty('--spotlight-y', `${event.clientY}px`)
      })
    }
    window.addEventListener('pointermove', trackPointer, { passive: true })
    return () => {
      window.removeEventListener('pointermove', trackPointer)
      cancelAnimationFrame(frame)
    }
  }, [])
  const { navbar, footer } = useSiteSettings()
  const usePublicChrome = true
  const navLinks = usePublicChrome
    ? homepageNavigation.flatMap(({ href, label }) => {
      const link = navbar.links.find((item) => item.visible && item.href.split('#')[0] === href)
        ?? (href === '/event-flow' ? { href, label, visible: true, highlight: false } : null)
      return link
        ? [{ ...link, label, highlight: false }]
        : []
    })
    : navbar.links.filter((link) => link.visible)
  const footerColumns = usePublicChrome
    ? footer.columns
      .filter((column) => column.title === 'Quick Links' || column.title === 'For Artists')
      .map((column) => ({
        ...column,
        title: column.title === 'For Artists' ? 'For Participants' : column.title,
        links: (column.title === 'Quick Links'
          ? [
            ...column.links.filter((link) => link.label !== 'Media Coverage'),
            ...(column.links.some((link) => link.href === '/event-flow') ? [] : [{ label: 'Event Flow', href: '/event-flow' }]),
          ]
          : column.links)
          .map((link) => ({ ...link, href: legalHref(link.label, link.href) })),
      }))
    : footer.columns.map((column) => ({
      ...column,
      links: column.links.map((link) => ({ ...link, href: legalHref(link.label, link.href) })),
    }))
  const homepageLegalLinks = footer.columns.find((column) => column.title === 'Legal')?.links
    .filter((link) => link.label === 'Privacy Policy' || link.label === 'Terms & Conditions')
    .map((link) => ({ ...link, href: legalHref(link.label, link.href) })) ?? []
  const whatsappUrl = `https://wa.me/${footer.whatsapp}?text=${encodeURIComponent(whatsappMessage)}`
  const socials = footer.social
  const socialItems: { key: SocialNetwork; label: string; className: string }[] = [
    { key: 'facebook', label: 'Facebook', className: 'fb' },
    { key: 'instagram', label: 'Instagram', className: 'ig' },
    { key: 'youtube', label: 'YouTube', className: 'yt' },
    { key: 'linkedin', label: 'LinkedIn', className: 'in' },
    { key: 'x', label: 'X', className: 'x' },
  ]
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
    <PartnerInquiryProvider>
    <PublicShellContext.Provider value>
    <div ref={publicSiteRef} className={`public-site gallery-light-mode${homepage ? ' homepage-shell' : ''}${usePublicChrome ? ' home-chrome' : ''}`}>
      <header className={`public-header${homepage && heroVisible ? ' is-over-hero' : ''}`}>
        <div className="public-header-inner">
          <Link className="public-logo" href="/" aria-label="The Haat of Art home">
            {logoUrl
              ? usePublicChrome
                ? <img className="homepage-brand-mark" src={logoUrl} alt="" width={52} height={52} />
                : <img src={logoUrl} alt="" width={120} height={56} />
              : <span aria-hidden="true">H</span>}
            {usePublicChrome
              ? <span className="public-brand-copy"><strong>{logoAlt}</strong><small>Art · Culture · Creativity</small></span>
              : <span className="public-brand-name">{logoAlt}</span>}
          </Link>
          <nav className="public-nav" aria-label="Main navigation">
            {navLinks.map(({ label, href, highlight }) => {
              const route = href.split('#')[0]
              const isCurrent = !isExternal(href) && route !== '' && (route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`))
              const cls = highlight ? 'nav-registration' : undefined
              return isExternal(href)
                ? <a href={href} key={label + href} className={cls} {...externalLinkProps(href)} onClick={() => setOpen(false)}>{label}</a>
                : <Link href={href} key={label + href} className={cls} aria-current={isCurrent ? 'page' : undefined}>{label}</Link>
            })}
            {!usePublicChrome && navbar.showSearch && <Link className="public-search" href="/gallery" aria-label="Search the gallery"><Search size={17} /></Link>}
          </nav>
          {usePublicChrome && <div className="homepage-header-actions">
            <Link className="homepage-account" href="/login" aria-label="Profile / Login" title="Profile / Login"><UserRound size={21} /></Link>
            <Link
              className="homepage-visitor-cta"
              href="/indore"
              aria-current={pathname === '/indore' || pathname === '/visitor' || pathname.startsWith('/visitor/') ? 'page' : undefined}
            >
              <TicketCheck size={16} aria-hidden="true" />
              Visitor Pass
            </Link>
            <MagneticLink className="homepage-stall-cta" href="/book-your-stall" aria-current={pathname.startsWith('/book-your-stall') ? 'page' : undefined}>Book Stall</MagneticLink>
          </div>}
          <button ref={menuButtonRef} type="button" className="public-menu" aria-controls="site-navigation" aria-expanded={open} onClick={() => setOpen(!open)} aria-label="Open navigation"><Menu size={24} /></button>
        </div>
      </header>
      {open && (
        <>
          <button className="navigation-drawer-backdrop" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <aside className="navigation-drawer" role="dialog" aria-modal="true" aria-labelledby="navigation-drawer-title">
            <div className="navigation-drawer-head">
              <div>
                <p className="navigation-drawer-eyebrow">THE HAAT OF ART</p>
                <h2 id="navigation-drawer-title">Explore</h2>
              </div>
              <button ref={drawerCloseRef} className="navigation-drawer-close" type="button" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={22} /></button>
            </div>
            <nav id="site-navigation" className="navigation-drawer-links" aria-label="Main navigation">
              {navLinks.map(({ label, href }) => {
                const route = href.split('#')[0]
                const isCurrent = !isExternal(href) && route !== '' && (route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`))
                return isExternal(href)
                  ? <a href={href} key={label + href} {...externalLinkProps(href)} onClick={() => setOpen(false)}>{label}</a>
                  : <Link href={href} key={label + href} aria-current={isCurrent ? 'page' : undefined} onClick={() => setOpen(false)}>{label}</Link>
              })}
            </nav>
            <div className="navigation-drawer-actions">
              <Link className="navigation-drawer-visitor" href="/indore" onClick={() => setOpen(false)}><TicketCheck size={17} aria-hidden="true" />Visitor Pass</Link>
              <Link className="navigation-drawer-stall" href="/book-your-stall" onClick={() => setOpen(false)}>Book Stall</Link>
              <Link className="navigation-drawer-login" href="/login" onClick={() => setOpen(false)}><UserRound size={17} aria-hidden="true" />Artist / Partner Login</Link>
            </div>
          </aside>
        </>
      )}
      <main className="public-main">{children}</main>
      <footer className="th-footer" id="contact">
        <section className="thf-news" aria-label="Newsletter">
          <div className="thf-news-copy">
            <NewsletterHeading className="thf-news-title">{footer.newsletterTitle}</NewsletterHeading>
            <p>{footer.newsletterText}</p>
          </div>
          <form className="thf-news-form" onSubmit={subscribe}>
            <div className="thf-news-control">
              <label><Mail size={18} /><input aria-label="Email address" type="email" required placeholder="Enter your email address" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <button type="submit" disabled={subscribing}>{subscribing ? 'Subscribing…' : 'Subscribe'}</button>
            </div>
            <small role="status" aria-live="polite">{status || 'We respect your privacy. Unsubscribe anytime.'}</small>
          </form>
          <div className="thf-news-photo" aria-hidden="true" />
        </section>
        <div className="thf-main">
          <div className="thf-brand">
            <Link className="public-logo" href="/" aria-label="The Haat of Art home">{logoUrl ? <img src={logoUrl} alt={logoAlt} width={120} height={56} /> : <span>H</span>}</Link>
            <p>{footer.about}</p>
            {pathname === '/' && footerLocations && <p className="thf-home-footer-locations">{footerLocations}</p>}
            <div className="thf-social">
              {socialItems.map(({ key, label, className }) => {
                const href = socialHref(socials[key])
                const icon = <SocialIcon network={key} label={label} />
                return href
                  ? <a key={key} href={href} aria-label={label} className={className} target="_blank" rel="noopener noreferrer">{icon}</a>
                  : <span key={key} className={`${className} is-unconfigured`} role="img" aria-label={`${label} link not configured`} title={`${label} link not configured`}>{icon}</span>
              })}
            </div>
            <div className="thf-tag">            <span className="thf-script">{footer.script}</span><span className="thf-sub">{footer.scriptSub}</span></div>
                      </div>
                      {footerColumns.map((col) => (
                        <nav className="thf-col" aria-label={col.title} key={col.title}>
                          <h4>{col.title}</h4>
                          {col.links.map(({ label, href }) => isExternal(href)
                            ? <a key={label + href} href={href} {...externalLinkProps(href)}>{label}</a>
                            : <Link key={label + href} href={href}>{label}</Link>)}
                          {col.title === 'For Participants' && <PartnerInquiryTrigger className="thf-partner-cta">Become a Partner</PartnerInquiryTrigger>}
                        </nav>
                      ))}
          <div className="thf-col thf-contact">
            <h4>Contact Us</h4>
            <span><MapPin size={20} /><span><b>The Haat of Art Foundation</b>            {footer.address}</span></span>
                        <span><Phone size={20} /><span>{formatFooterPhones(footer.phone).map((phone, index) => (
                          <Fragment key={`${phone}-${index}`}>{index > 0 && <><br />· </>}{phone}</Fragment>
                        ))}</span></span>
                        <span><Mail size={20} /><span>{footer.email}</span></span>
                        <span><Clock size={20} /><span className="thf-contact-hours">{footer.hours}</span></span>
            <div className="thf-art" aria-hidden="true"><i /><i /></div>
          </div>
        </div>
        <div className="thf-bar">
          <span className="thf-ptitle">{footer.partnersTitle}</span>
          <div className="thf-partners">
            {footer.partners.map((name) => <span key={name} className="thf-p">{name}</span>)}
          </div>
          {usePublicChrome && <nav className="thf-home-legal" aria-label="Legal">
            {homepageLegalLinks.map(({ label, href }) => isExternal(href)
              ? <a key={label + href} href={href} {...externalLinkProps(href)}>{label}</a>
              : <Link key={label + href} href={href}>{label}</Link>)}
          </nav>}
          <span className="thf-copy">{footer.copyright.split('\n').map((line, i) => <span key={i}>{i > 0 && <br />}{line}</span>)}</span>
          <button type="button" className="thf-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp size={20} /></button>
        </div>
      </footer>
      {!pathname?.startsWith('/dashboard') && <div className="public-floating-actions">
        <WelcomeExperience pathname={pathname ?? '/'} />
        <a
          className="wa-btn"
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          title="Chat with us on WhatsApp"
          style={{ position: 'static', right: 'auto', bottom: 'auto', zIndex: 1 }}
        >
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" fill="currentColor"><path d="M16.04 3C9.4 3 4 8.38 4 15c0 2.12.56 4.18 1.6 6L4 29l8.2-1.56A12 12 0 0 0 16.04 28C22.68 28 28 22.62 28 16S22.68 3 16.04 3Zm0 21.9c-1.8 0-3.56-.5-5.1-1.4l-.36-.22-4.86.92.96-4.7-.24-.38A9.9 9.9 0 0 1 6.1 15c0-5.46 4.46-9.9 9.94-9.9 5.5 0 9.9 4.44 9.9 9.9s-4.4 9.9-9.9 9.9Zm5.44-7.4c-.3-.14-1.76-.86-2.04-.96-.26-.1-.46-.14-.66.14-.2.3-.76.96-.94 1.16-.16.2-.34.22-.64.08-1.76-.88-2.9-1.58-4.06-3.56-.3-.52.3-.48.88-1.62.1-.2.04-.36-.02-.5-.08-.14-.66-1.6-.9-2.18-.24-.58-.48-.5-.66-.5h-.56c-.2 0-.5.08-.76.36-.26.3-1 .98-1 2.4s1.02 2.78 1.16 2.98c.14.2 2.02 3.08 4.9 4.32 1.82.78 2.54.84 3.46.7.56-.08 1.76-.72 2-1.42.24-.7.18-1.3.18-1.42-.08-.12-.28-.2-.58-.34Z"/></svg>
        </a>
      </div>}
    </div>
    </PublicShellContext.Provider>
    </PartnerInquiryProvider>
  )
}

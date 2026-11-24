export type SiteLink = { label: string; href: string }
export type NavLink = SiteLink & { visible: boolean; highlight: boolean }
export type SiteSettings = {
  theme: { orange: string; navy: string; cream: string; card: string; muted: string; line: string }
  navbar: { links: NavLink[]; showSearch: boolean }
  footer: {
    about: string; script: string; scriptSub: string; newsletterTitle: string; newsletterText: string
    address: string; phone: string; email: string; hours: string; copyright: string; partnersTitle: string; whatsapp: string
    social: { facebook: string; instagram: string; youtube: string; linkedin: string; x: string }
    columns: { title: string; links: SiteLink[] }[]
    partners: string[]
  }
}

const nav = (label: string, href: string, highlight = false): NavLink => ({ label, href, visible: true, highlight })

export const defaultSiteSettings: SiteSettings = {
  theme: { orange: '#a84323', navy: '#1a1918', cream: '#faf8f5', card: '#f3ece4', muted: '#706963', line: '#ded5cb' },
  navbar: {
    showSearch: true,
    links: [
      nav('Home', '/'), nav('About', '/about'), nav('Exhibitions', '/exhibitions'), nav('Event Flow', '/event-flow'), nav('Visitor', '/indore'), nav('Highlights', '/highlights'),
      nav('Gallery', '/gallery'), nav('Artists', '/artists'), nav('Blogs', '/blog'), nav('Contact', '/contact'), nav('Registration', '/artist/register', true),
    ],
  },
  footer: {
    about: 'The Haat of Art is a platform that brings together artists, art lovers and cultural communities through exhibitions, creativity and meaningful experiences.',
    script: 'Art Connects People',
    scriptSub: 'Ideas · Cultures · Beyond Borders',
    newsletterTitle: 'Stay Connected with The Haat of Art',
    newsletterText: 'Get updates on upcoming exhibitions, artist stories, blogs and more.',
    address: 'C-503, Mayro House, Behind Crystal Plaza, Veera Desai, Andheri (West), Mumbai, India',
    phone: '+91 73046 45333 · +91 87797 98244',
    email: 'contact@thehaatofart.com',
    hours: 'Mon - Sat: 10:00 AM - 6:00 PM',
    copyright: '© 2026 The Haat of Art. All Rights Reserved.\nDesigned to celebrate art, artists and communities.',
    partnersTitle: 'Our Partners & Supporters',
    whatsapp: '918052696360',
    social: { facebook: '', instagram: '', youtube: '', linkedin: '', x: '' },
    columns: [
      { title: 'Quick Links', links: [['Home', '/'], ['About Us', '/about'], ['Exhibitions', '/exhibitions'], ['Event Flow', '/event-flow'], ['Artists', '/artists'], ['Gallery', '/gallery'], ['Blogs', '/blog'], ['Media Coverage', '/blog'], ['Contact Us', '/contact']].map(([label, href]) => ({ label, href })) },
      { title: 'For Artists', links: [['Artist Registration', '/artist/register'], ['Exhibition Opportunities', '/exhibitions'], ['Stall Booking', '/book-your-stall'], ['Guidelines', '/exhibitions'], ['Resources', '/blog'], ['Success Stories', '/highlights'], ['Artist Login', '/login']].map(([label, href]) => ({ label, href })) },
      { title: 'For Visitors', links: [['Visitor Registration', '/indore#register'], ['Upcoming Exhibitions', '/exhibitions'], ['Event Calendar', '/exhibitions'], ['Past Exhibitions', '/highlights'], ['Plan Your Visit', '/indore'], ['FAQ', '/contact'], ['Visitor Login', '/login']].map(([label, href]) => ({ label, href })) },
      { title: 'Legal', links: [['Privacy Policy', '/privacy-policy'], ['Terms & Conditions', '/terms-and-conditions'], ['Cancellation & Refund', '/contact'], ['Artist Agreement', '/contact'], ['Cookie Policy', '/contact'], ['Accessibility', '/contact'], ['Sitemap', '/']].map(([label, href]) => ({ label, href })) },
    ],
    partners: [],
  },
}

// Saved settings always win, but any missing section falls back to the built-in defaults so a partial save can never blank the site.
export function mergeSiteSettings(saved: Partial<SiteSettings> | null | undefined): SiteSettings {
  const d = defaultSiteSettings
  if (!saved) return d
  return {
    theme: { ...d.theme, ...saved.theme },
    navbar: { showSearch: saved.navbar?.showSearch ?? d.navbar.showSearch, links: saved.navbar?.links ?? d.navbar.links },
    footer: { ...d.footer, ...saved.footer, social: { ...d.footer.social, ...saved.footer?.social }, columns: saved.footer?.columns ?? d.footer.columns, partners: saved.footer?.partners ?? d.footer.partners },
  }
}

export function themeCss(theme: SiteSettings['theme']) {
  const hex = theme.orange.trim().replace(/^#/, '')
  const normalized = /^[0-9a-f]{6}$/i.test(hex) ? hex : 'a84323'
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  const toLinear = (channel: number) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  const contrast = (other: number) => (Math.max(luminance, other) + 0.05) / (Math.min(luminance, other) + 0.05)
  let ink = theme.navy
  if (contrast(0) < 4.5) {
    const darkInkR = Math.round(r * 0.48)
    const darkInkG = Math.round(g * 0.48)
    const darkInkB = Math.round(b * 0.48)
    ink = `#${[darkInkR, darkInkG, darkInkB].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
  }
  const contrastLuminance = 0.2126 * toLinear(parseInt(ink.slice(1, 3), 16)) + 0.7152 * toLinear(parseInt(ink.slice(3, 5), 16)) + 0.0722 * toLinear(parseInt(ink.slice(5, 7), 16))
  if (contrast(contrastLuminance) < 4.5) ink = '#7a2608'
  return `html:root{--haat-color-brand:#${normalized};--haat-color-brand-contrast:${ink};--haat-color-ink:${theme.navy};--haat-color-canvas:${theme.cream};--haat-color-surface:${theme.card};--haat-color-muted:${theme.muted};--haat-color-line:${theme.line};--th-orange:#${normalized};--th-orange-contrast:${ink};--th-navy:${theme.navy};--th-cream:${theme.cream};--th-card:${theme.card};--th-muted:${theme.muted};--th-line:${theme.line}}`
}

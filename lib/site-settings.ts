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
  theme: { orange: '#ee4b12', navy: '#0f1e36', cream: '#fdf4ea', card: '#fffaf4', muted: '#5d6677', line: '#f3dcc8' },
  navbar: {
    showSearch: true,
    links: [
      nav('Home', '/'), nav('About', '/about'), nav('Exhibitions', '/exhibitions'), nav('Visitor Pass', '/indore#register'), nav('Highlights', '/highlights'),
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
    phone: '+91 7304645333 | 8779798244',
    email: 'contact@thehaatofart.com',
    hours: 'Mon - Sat: 10:00 AM - 6:00 PM',
    copyright: '© 2026 The Haat of Art. All Rights Reserved.\nDesigned to celebrate art, artists and communities.',
    partnersTitle: 'Our Partners & Supporters',
    whatsapp: '918052696360',
    social: { facebook: '', instagram: '', youtube: '', linkedin: '', x: '' },
    columns: [
      { title: 'Quick Links', links: [['Home', '/'], ['About Us', '/about'], ['Exhibitions', '/exhibitions'], ['Artists', '/artists'], ['Gallery', '/gallery'], ['Blogs', '/blog'], ['Media Coverage', '/blog'], ['Contact Us', '/contact']].map(([label, href]) => ({ label, href })) },
      { title: 'For Artists', links: [['Artist Registration', '/artist/register'], ['Exhibition Opportunities', '/exhibit-with-us'], ['Stall Booking', '/book-your-stall'], ['Guidelines', '/exhibit-with-us'], ['Resources', '/blog'], ['Success Stories', '/highlights'], ['Artist Login', '/login']].map(([label, href]) => ({ label, href })) },
      { title: 'For Visitors', links: [['Visitor Registration', '/indore#register'], ['Upcoming Exhibitions', '/exhibitions'], ['Event Calendar', '/exhibitions'], ['Past Exhibitions', '/highlights'], ['Plan Your Visit', '/indore'], ['FAQ', '/contact'], ['Visitor Login', '/login']].map(([label, href]) => ({ label, href })) },
      { title: 'Legal', links: [['Privacy Policy', '/contact'], ['Terms & Conditions', '/contact'], ['Cancellation & Refund', '/contact'], ['Artist Agreement', '/contact'], ['Cookie Policy', '/contact'], ['Accessibility', '/contact'], ['Sitemap', '/']].map(([label, href]) => ({ label, href })) },
    ],
    partners: ['NESCO', 'ITC HOTELS', 'TAI', 'INDORE SPORTS CLUB', 'PHOENIX', 'THE PARK'],
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
  return `html:root{--th-orange:${theme.orange};--th-navy:${theme.navy};--th-cream:${theme.cream};--th-card:${theme.card};--th-muted:${theme.muted};--th-line:${theme.line}}`
}

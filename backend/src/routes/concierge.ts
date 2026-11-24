import crypto from 'node:crypto'
import rateLimit from '../services/rate-limit.js'
import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { avoidImmediateRepeat, detectConciergeLanguage, inferFollowUpIntent, isConciergeCheckIn, isSpecificFactualQuestion, leadershipRoster, shouldSendGreeting, type ConciergeLanguage } from '../services/concierge-language.js'
import { currentIndiaSqlDateTime } from '../services/exhibition-schedule.js'

export const conciergeRouter = Router()

const roles = ['ARTIST_EXHIBITOR', 'ART_VISITOR', 'COLLECTOR_BUYER', 'BRAND_VENUE_PARTNER'] as const
const tokenPattern = /^[a-f0-9]{64}$/i
const leadLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false })
const messageLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false })
const conversationLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 80, standardHeaders: true, legacyHeaders: false })
const adminOnly = [requireAuth, requirePermission('enquiries:manage')] as const

const leadInput = z.object({
  leadId: z.string().uuid().optional(),
  sessionToken: z.string().regex(tokenPattern).optional(),
  name: z.string().trim().min(2).max(160),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.'),
  email: z.string().trim().toLowerCase().email().max(255),
  role: z.enum(roles),
  sourcePage: z.string().trim().min(1).max(220).refine((value) => value.startsWith('/') && !value.startsWith('//'), 'Enter a valid source page.'),
  consent: z.literal(true, { error: 'Please accept the privacy notice before continuing.' }),
}).strict().refine((value) => Boolean(value.leadId) === Boolean(value.sessionToken), {
  message: 'A lead ID and session token must be provided together.',
  path: ['leadId'],
})

const messageInput = z.object({
  leadId: z.string().uuid(),
  sessionToken: z.string().regex(tokenPattern),
  text: z.string().trim().min(1).max(1200),
}).strict()

const conversationInput = z.object({
  leadId: z.string().uuid(),
  sessionToken: z.string().regex(tokenPattern),
}).strict()

type Action = { label: string; href: string }
type Reply = { detectedIntent: string; text: string; actions: Action[] }
type ConversationMessage = { sender: 'USER' | 'ASSISTANT'; text: string; detectedIntent: string }

function tokenHash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || 'there'
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
}

function greeting(language: ConciergeLanguage, name: string) {
  if (language === 'HINDI') return `नमस्ते ${name}!`
  return language === 'HINGLISH' ? `Namaste ${name}!` : `Hey ${name}!`
}

function formatScheduleDates(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const options = { timeZone: 'Asia/Kolkata' } as const
  const startYear = new Intl.DateTimeFormat('en', { ...options, year: 'numeric' }).format(start)
  const endYear = new Intl.DateTimeFormat('en', { ...options, year: 'numeric' }).format(end)
  const sameMonth = new Intl.DateTimeFormat('en', { ...options, month: 'numeric' }).format(start)
    === new Intl.DateTimeFormat('en', { ...options, month: 'numeric' }).format(end)

  if (sameMonth && startYear === endYear) {
    const month = new Intl.DateTimeFormat('en', { ...options, month: 'short' }).format(start)
    const startDay = new Intl.DateTimeFormat('en', { ...options, day: 'numeric' }).format(start)
    const endDay = new Intl.DateTimeFormat('en', { ...options, day: 'numeric' }).format(end)
    return `${month} ${startDay}–${endDay}, ${startYear}`
  }
  const monthDay = new Intl.DateTimeFormat('en', { ...options, month: 'short', day: 'numeric' })
  return `${monthDay.format(start)}, ${startYear} – ${monthDay.format(end)}, ${endYear}`
}

function normalizedScheduleTitle(value: string) {
  return value.toLowerCase()
    .replace(/^the haat of art\s*[—-]?\s*/, '')
    .replace(/\b20\d{2}\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function upcomingScheduleLines() {
  const now = currentIndiaSqlDateTime()
  const [galleryRows] = await pool.query<any[]>(`
    SELECT title, schedule_label scheduleLabel, city_label cityLabel, venue, status_label statusLabel,
           CONCAT(DATE_FORMAT(start_date, '%Y-%m-%dT%H:%i:%s'), '+05:30') startDate,
           CONCAT(DATE_FORMAT(end_date, '%Y-%m-%dT%H:%i:%s'), '+05:30') endDate
    FROM gallery_upcoming_editions
    WHERE published=1 AND show_on_gallery=1 AND end_date IS NOT NULL AND end_date >= ?
    ORDER BY start_date ASC, sort_order ASC, created_at ASC
    LIMIT 12`, [now])
  const [eventRows] = await pool.query<any[]>(`
    SELECT title, city, venue,
           CONCAT(DATE_FORMAT(starts_at, '%Y-%m-%dT%H:%i:%s'), '+05:30') startDate,
           CONCAT(DATE_FORMAT(ends_at, '%Y-%m-%dT%H:%i:%s'), '+05:30') endDate
    FROM events
    WHERE status IN ('PUBLISHED','APPROVED') AND ends_at >= ?
    ORDER BY starts_at ASC, id ASC
    LIMIT 12`, [now])

  const knownTitles = new Set(galleryRows.map((row) => normalizedScheduleTitle(row.title)))
  const entries = [
    ...galleryRows.map((row) => ({
      ...row,
      cityLabel: String(row.cityLabel ?? ''),
      statusLabel: String(row.statusLabel ?? ''),
    })),
    ...eventRows
      .filter((row) => !knownTitles.has(normalizedScheduleTitle(row.title)))
      .map((row) => ({
        ...row,
        scheduleLabel: formatScheduleDates(String(row.startDate), String(row.endDate)),
        cityLabel: String(row.city ?? ''),
        statusLabel: '',
      })),
  ]
  return entries
    .sort((a, b) => Date.parse(String(a.startDate)) - Date.parse(String(b.startDate)))
    .slice(0, 6)
    .map((row) => {
      const location = String(row.venue || row.cityLabel || '')
      const status = row.statusLabel ? ` — ${row.statusLabel}` : ''
      return `• ${row.scheduleLabel} · ${row.title}${location ? ` at ${location}` : ''}${status}`
    })
}

async function buildReply(text: string, leadName: string, history: ConversationMessage[]): Promise<Reply> {
  const language = detectConciergeLanguage(text)
  const previousIntent = [...history].reverse().find((message) => message.sender === 'ASSISTANT')?.detectedIntent ?? null
  const intent = inferFollowUpIntent(text, previousIntent)
  const name = firstName(leadName)
  const hello = shouldSendGreeting(history) ? greeting(language, name) : ''
  const userTurns = history.filter((message) => message.sender === 'USER').length
  let reply: Reply

  if (intent === 'GREETING') {
    const greetings: Record<ConciergeLanguage, string[]> = {
      ENGLISH: [
        `${hello} Nice to see you! I’m THOA, your art guide. I can help with exhibitions, visitor passes, stall booking, or connect you with our team. What’s on your mind?`,
        `${hello} Glad you’re here! Would you like help planning a visit, exploring exhibitions, booking a stall, or reaching our team?`,
      ],
      HINGLISH: [
        `${hello} Aapse milkar achha laga! Exhibition, visitor pass, stall booking ya team se baat—kis cheez mein help karoon?`,
        `${hello} Main yahin hoon—visit plan karna ho, exhibition dekhni ho ya stall book karna ho, bataiye.`,
      ],
      HINDI: [
        `${hello} आपसे मिलकर अच्छा लगा! प्रदर्शनी, विज़िटर पास, स्टॉल बुकिंग या हमारी टीम से जुड़ने में मैं मदद कर सकती हूँ। आप क्या जानना चाहेंगे?`,
        `${hello} स्वागत है! अगर आप प्रदर्शनी देखने की योजना बना रहे हैं या स्टॉल बुक करना चाहते हैं, बताइए—मैं मदद करूँगी।`,
      ],
    }
    const checkInReplies: Record<ConciergeLanguage, string> = {
      ENGLISH: `${hello} I’m doing well, thanks for asking! I can help with an exhibition, visitor pass, stall booking, or connect you with our team. What would be useful?`,
      HINGLISH: `${hello} Main badhiya hoon, poochhne ke liye shukriya! Exhibition, visitor pass, stall booking ya team se baat—kis cheez mein help chahiye?`,
      HINDI: `${hello} मैं बढ़िया हूँ, पूछने के लिए शुक्रिया! प्रदर्शनी, विज़िटर पास, स्टॉल बुकिंग या हमारी टीम से जुड़ने में मदद चाहिए?`,
    }
    reply = {
      detectedIntent: 'GREETING',
      text: isConciergeCheckIn(text) ? checkInReplies[language] : greetings[language][userTurns % 2] ?? hello,
      actions: [],
    }
  } else if (intent === 'APPRECIATION') {
    const thanks: Record<ConciergeLanguage, string> = {
      ENGLISH: 'You’re very welcome! I’m here if you need anything else.',
      HINGLISH: 'Koi baat nahi! Aage kisi cheez mein help chahiye ho toh zaroor poochhiye.',
      HINDI: 'आपका स्वागत है! आगे किसी भी मदद की ज़रूरत हो तो बेझिझक पूछिए।',
    }
    reply = { detectedIntent: 'APPRECIATION', text: thanks[language], actions: [] }
  } else if (intent === 'ART_ENGAGEMENT') {
    const prompts: Record<ConciergeLanguage, string[]> = {
      ENGLISH: [
        'Quick sketch challenge: draw a tiny art fair using only circles and straight lines—2 minutes, no erasing.',
        'Palette play: terracotta, indigo, and butter yellow. Sketch a rainy street using only those three—what mood does it get?',
        'Creative warm-up: make a 30-second continuous-line doodle of the nearest object without lifting your pen.',
      ],
      HINGLISH: [
        'Mini sketch challenge: 2 minute mein sirf circles aur straight lines se chhota art fair doodle karo—eraser nahi!',
        'Colour-palette game: terracotta, indigo aur haldi yellow. In teen colours se rainy street banao—mood kaisa lagega?',
        '30-second warm-up: paas ki kisi cheez ka continuous-line doodle banao, pen uthaye bina.',
      ],
      HINDI: [
        'छोटा sketch challenge: सिर्फ़ गोल और सीधी रेखाओं से 2 मिनट में एक mini art fair बनाइए—इरेज़र नहीं!',
        'रंगों का खेल: टेराकोटा, इंडिगो और हल्दी पीला—सिर्फ़ इन तीन रंगों से बारिश वाली गली बनाइए। उसका mood कैसा होगा?',
        '30-second warm-up: पास की किसी चीज़ का continuous-line doodle बनाइए—pen उठाए बिना।',
      ],
    }
    reply = {
      detectedIntent: 'ART_ENGAGEMENT',
      text: `${hello} ${prompts[language][userTurns % prompts[language].length]}`,
      actions: [],
    }
  } else if (intent === 'PLATFORM') {
    const textByLanguage: Record<ConciergeLanguage, string> = {
      ENGLISH: `${hello} Here’s how The Haat of Art brings everyone together:\n\n1. Artists book exhibition stalls and keep 100% of direct sales—there’s 0% sales commission.\n2. Visitors choose Free or VIP passes to explore live art and workshops.\n3. Collectors discover artists and connect directly with the creators.\n\nTell me which part you’d like to explore first.`,
      HINGLISH: `${hello} The Haat of Art artists, visitors aur collectors ko India bhar mein is tarah connect karta hai:\n\n1. Artists exhibition stall book karte hain aur direct sales ka 100% rakhte hain—0% sales commission.\n2. Visitors Free ya VIP pass lekar live art aur workshops explore karte hain.\n3. Collectors artists ko discover karke creators se directly connect karte hain.\n\nAap kis step ke baare mein pehle jaan-na chahenge?`,
      HINDI: `${hello} The Haat of Art पूरे भारत में कलाकारों, दर्शकों और कलेक्टर्स को इस तरह जोड़ता है:\n\n1. कलाकार प्रदर्शनी में स्टॉल बुक करते हैं और अपनी सीधी बिक्री का 100% रखते हैं—कोई बिक्री कमीशन नहीं।\n2. दर्शक Free या VIP पास लेकर लाइव कला और वर्कशॉप देखते हैं।\n3. कलेक्टर्स कलाकारों को खोजकर उनसे सीधे जुड़ते हैं।\n\nआप किस चरण के बारे में पहले जानना चाहेंगे?`,
    }
    reply = {
      detectedIntent: 'PLATFORM',
      text: textByLanguage[language],
      actions: [
        { label: 'Explore Exhibitions', href: '/exhibitions' },
        { label: 'Book Stall', href: '/book-your-stall' },
      ],
    }
  } else if (intent === 'MENTOR_STORY') {
    reply = {
      detectedIntent: 'MENTOR_STORY',
      text: `${hello} ${leadershipRoster[language]}`,
      actions: [{ label: 'Meet Our Mentor & Story', href: '/about-us' }],
    }
  } else if (intent === 'EDITION_STATS') {
    const schedule = await upcomingScheduleLines()
    const upcoming = schedule.length
      ? schedule.join('\n')
      : language === 'HINDI'
        ? 'अभी कोई आगामी तारीख Admin ने प्रकाशित नहीं की है।'
        : language === 'HINGLISH'
          ? 'Abhi Admin ne koi upcoming date publish nahi ki hai.'
          : 'No upcoming dates have been published by the Admin yet.'
    const information: Record<ConciergeLanguage, string> = {
      ENGLISH: `${hello} The Haat of Art’s verified milestones are 2,500+ exhibitors, 40,000+ artworks displayed, 77,000+ visitors and ₹17.60 Cr+ in artwork sold—with 0% sales commission on artists’ direct sales.\n\nOur completed editions from 2022–2026 span Mumbai, Indore, Bengaluru, Pune and New Delhi.\n\nNearest Admin-confirmed upcoming editions:\n${upcoming}\n\nMore 2027 city dates will appear as the Admin confirms them.`,
      HINGLISH: `${hello} The Haat of Art ke verified milestones hain: 2,500+ exhibitors, 40,000+ artworks displayed, 77,000+ visitors aur ₹17.60 Cr+ artwork sales—artists ki direct sales par 0% commission.\n\n2022–2026 ke completed editions Mumbai, Indore, Bengaluru, Pune aur New Delhi mein rahe hain.\n\nAdmin-confirmed upcoming editions:\n${upcoming}\n\n2027 ke aur city dates Admin confirm karte hi update honge.`,
      HINDI: `${hello} The Haat of Art के verified milestones हैं: 2,500+ exhibitors, 40,000+ artworks displayed, 77,000+ visitors और ₹17.60 Cr+ artwork sales—कलाकारों की direct sales पर 0% commission.\n\n2022–2026 के completed editions Mumbai, Indore, Bengaluru, Pune और New Delhi में हुए हैं।\n\nAdmin द्वारा confirmed आगामी editions:\n${upcoming}\n\n2027 के अन्य शहरों की तारीखें Admin के confirm करते ही अपडेट होंगी।`,
    }
    reply = {
      detectedIntent: 'EDITION_STATS',
      text: information[language],
      actions: [{ label: 'View Exhibition Archive', href: '/gallery' }],
    }
  } else if (intent === 'UPCOMING_EXHIBITIONS') {
    const editions = await upcomingScheduleLines()
    const emptyByLanguage: Record<ConciergeLanguage, string> = {
      ENGLISH: 'No upcoming exhibition dates have been published yet. Please check again soon.',
      HINGLISH: 'Abhi koi nayi exhibition date publish nahi hui hai. Thodi der baad phir check karein.',
      HINDI: 'अभी आने वाली प्रदर्शनी की तारीखें प्रकाशित नहीं हुई हैं। कृपया कुछ समय बाद फिर देखें।',
    }
    const leadIn: Record<ConciergeLanguage, string> = {
      ENGLISH: `${hello} I checked the latest exhibition schedule. Here are the nearest editions:`,
      HINGLISH: `${hello} Maine latest exhibition schedule check kiya—yeh sabse nazdeek editions hain:`,
      HINDI: `${hello} मैंने ताज़ा प्रदर्शनी शेड्यूल देखा—ये आने वाले नज़दीकी संस्करण हैं:`,
    }
    const closing: Record<ConciergeLanguage, string> = {
      ENGLISH: 'Dates update from the Admin schedule. Choose a city to see visitor-pass options.',
      HINGLISH: 'Dates Admin schedule se update hoti hain. Visitor pass options ke liye apna city chunein.',
      HINDI: 'तारीखें Admin शेड्यूल से अपडेट होती हैं। विज़िटर पास देखने के लिए अपना शहर चुनें।',
    }
    reply = {
      detectedIntent: 'UPCOMING_EXHIBITIONS',
      text: `${leadIn[language]}\n${editions.length ? editions.join('\n') : emptyByLanguage[language]}\n\n${closing[language]}`,
      actions: [{ label: 'Get Visitor Pass', href: '/indore' }],
    }
  } else if (intent === 'STALL_BOOKING') {
    const [stallRows] = await pool.query<any[]>(`
      SELECT name, width_m widthM, depth_m depthM
      FROM stall_types
      WHERE active=1
      ORDER BY sort_order ASC, name ASC`)
    const stalls = stallRows.map((row) => `• ${row.name}: ${Number(row.widthM)}×${Number(row.depthM)}m`)
    const [rateRows] = await pool.query<any[]>(`
      SELECT e.title eventTitle, e.city, s.name stallName, p.price
      FROM event_stall_pricing p
      JOIN events e ON e.id=p.event_id
      JOIN stall_types s ON s.id=p.stall_type_id
      WHERE p.public_visible=1 AND e.status IN ('PUBLISHED','APPROVED') AND e.ends_at >= ?
      ORDER BY e.starts_at ASC, s.sort_order ASC
      LIMIT 12`, [currentIndiaSqlDateTime()])
    const rates = rateRows.map((row) => `• ${row.city} — ${row.eventTitle}, ${row.stallName}: ${formatCurrency(row.price)}`)
    const sizes = stalls.length ? stalls.join('\n') : 'Stall categories are being updated by the Exhibition Admin.'
    const rateInfo = rates.length
      ? `Current Admin-published rates:\n${rates.join('\n')}`
      : 'No city-specific rates have been published yet, so I won’t guess a price.'
    const textByLanguage: Record<ConciergeLanguage, string> = {
      ENGLISH: `${hello} You can choose from these stall categories:\n${sizes}\n\nTariffs are set by the Admin for each city and venue. ${rateInfo}\n\nBook your stall, choose a city to view its live tariff, then submit your artwork portfolio. You keep 100% of direct sales, with 0% sales commission.`,
      HINGLISH: `${hello} Aap in stall categories mein se choose kar sakte hain:\n${sizes}\n\nTariff har city aur venue ke liye Admin set karta hai. ${rates.length ? `Abhi publish kiye gaye rates:\n${rates.join('\n')}` : 'Abhi kisi city ke rates publish nahi hue hain, isliye main koi andaazee price nahi bataunga.'}\n\nStall book karein, live tariff ke liye city choose karein, phir artwork portfolio submit karein. Direct sales ka 100% aapka—0% sales commission.`,
      HINDI: `${hello} आप इन स्टॉल कैटेगरी में से चुन सकते हैं:\n${sizes}\n\nहर शहर और वेन्यू का टैरिफ Admin तय करता है। ${rates.length ? `अभी प्रकाशित दरें:\n${rates.join('\n')}` : 'अभी किसी शहर की दर प्रकाशित नहीं हुई है, इसलिए मैं अनुमानित कीमत नहीं बताऊँगा।'}\n\nस्टॉल बुक करें, लाइव टैरिफ के लिए शहर चुनें और अपना आर्ट पोर्टफोलियो जमा करें। सीधी बिक्री का 100% आपका—0% बिक्री कमीशन।`,
    }
    reply = {
      detectedIntent: 'STALL_BOOKING',
      text: textByLanguage[language],
      actions: [{ label: 'Book Stall', href: '/book-your-stall' }],
    }
  } else if (intent === 'VISITOR_PASSES') {
    const [rows] = await pool.query<any[]>(`
      SELECT e.title, e.city, c.pass_mode passMode, c.paid_price paidPrice
      FROM event_pass_configs c
      JOIN events e ON e.id=c.event_id
      WHERE e.status IN ('PUBLISHED','APPROVED') AND e.ends_at >= ?
      ORDER BY e.starts_at ASC
      LIMIT 4`, [currentIndiaSqlDateTime()])
    const details = rows.map((row) => {
      const options = row.passMode === 'BOTH'
        ? `Free General Entry and VIP Collector Pass (${formatCurrency(row.paidPrice)})`
        : row.passMode === 'FREE'
          ? 'Free General Entry'
          : `VIP Collector Pass (${formatCurrency(row.paidPrice)})`
      return `• ${row.title} · ${row.city}: ${options}`
    })
    const textByLanguage: Record<ConciergeLanguage, string> = {
      ENGLISH: `${hello} Visitor passes are configured by the Admin for each city and exhibition. General Entry is Free (₹0) where enabled; the VIP Collector & Preview Pass offers priority entry and workshop access where listed in that event’s configuration.${details.length ? `\n\nCurrent options:\n${details.join('\n')}` : ''}\n\nRegister to receive your QR entry pass.`,
      HINGLISH: `${hello} Visitor passes har city aur exhibition ke liye Admin configure karta hai. General Entry Free (₹0) hai jahan enabled ho; VIP Collector & Preview Pass mein priority entry aur workshop access us event ke configuration ke mutabik milta hai.${details.length ? `\n\nCurrent options:\n${details.join('\n')}` : ''}\n\nRegister karne par aapko QR entry pass milega.`,
      HINDI: `${hello} Visitor passes हर शहर और प्रदर्शनी के लिए Admin configure करता है। General Entry जहाँ enabled है वहाँ Free (₹0) है; VIP Collector & Preview Pass में priority entry और workshop access उस event के configuration के अनुसार मिलता है।${details.length ? `\n\nमौजूदा विकल्प:\n${details.join('\n')}` : ''}\n\nरजिस्ट्रेशन के बाद आपको QR entry pass मिलेगा।`,
    }
    reply = {
      detectedIntent: 'VISITOR_PASSES',
      text: textByLanguage[language],
      actions: [{ label: 'Get Visitor Pass', href: '/indore' }],
    }
  } else if (intent === 'ARTIST_SUPPORT') {
    const textByLanguage: Record<ConciergeLanguage, string> = {
      ENGLISH: `${hello} We welcome artists with different access and logistics needs.\n\n1. Share your work for inclusive curation and tell our team what support would help.\n2. Create your digital artist profile and portfolio.\n3. We’ll guide you toward suitable exhibitions and help connect your work with collectors across India.`,
      HINGLISH: `${hello} Har tarah ke artists ke liye inclusive curation aur support available hai.\n\n1. Apna artwork aur accessibility ya logistics needs team ke saath share karein.\n2. Apna digital artist profile aur portfolio banayein.\n3. Hum suitable exhibitions suggest karenge aur India bhar ke collectors se connect karne mein madad karenge.`,
      HINDI: `${hello} अलग-अलग ज़रूरतों वाले कलाकारों के लिए inclusive curation और सहायता उपलब्ध है।\n\n1. अपना काम साझा करें और accessibility या logistics support की ज़रूरत बताएँ।\n2. अपना digital artist profile और portfolio बनाएँ।\n3. हम उपयुक्त प्रदर्शनियाँ सुझाएँगे और देशभर के कलेक्टर्स से जुड़ने में मदद करेंगे।`,
    }
    reply = {
      detectedIntent: 'ARTIST_SUPPORT',
      text: textByLanguage[language],
      actions: [{ label: 'Explore Artist Profiles', href: '/artists' }, { label: 'Talk to the Team', href: '/contact' }],
    }
  } else if (intent === 'BRAND_PARTNERSHIP') {
    const textByLanguage: Record<ConciergeLanguage, string> = {
      ENGLISH: `${hello} We can explore title sponsorships, VIP lounge branding, or a venue partnership together.\n\n1. Tell us your preferred collaboration.\n2. Share your location, audience, and dates.\n3. Our partnerships team will follow up with suitable options.`,
      HINGLISH: `${hello} Hum title sponsorship, VIP lounge branding, ya venue partnership explore kar sakte hain.\n\n1. Apni preferred collaboration batayein.\n2. Location, audience aur dates share karein.\n3. Hamari partnerships team aapko suitable options ke saath contact karegi.`,
      HINDI: `${hello} हम title sponsorship, VIP lounge branding या venue partnership पर साथ में बात कर सकते हैं।\n\n1. अपनी पसंद की साझेदारी बताएँ।\n2. जगह, दर्शकों और तारीखों की जानकारी दें।\n3. हमारी partnerships team उपयुक्त विकल्पों के साथ आपसे संपर्क करेगी।`,
    }
    reply = {
      detectedIntent: 'BRAND_PARTNERSHIP',
      text: textByLanguage[language],
      actions: [
        { label: 'Contact Partnerships', href: '/contact' },
        { label: 'WhatsApp +91 7304645333', href: 'https://wa.me/917304645333' },
      ],
    }
  } else {
    if (isSpecificFactualQuestion(text)) {
      const responses: Record<ConciergeLanguage, string> = {
        ENGLISH: `${hello} I don’t have a confirmed answer for that detail in the information available to me, and I don’t want to guess. Our team can verify it for you—please contact them or send a WhatsApp message.`,
        HINGLISH: `${hello} Is specific detail ki confirmed info abhi mere paas nahi hai, isliye main andaaza nahi lagaunga. Hamari team ise verify kar sakti hai—Contact page ya WhatsApp par message karein.`,
        HINDI: `${hello} उपलब्ध जानकारी में इस बात की पुष्टि नहीं है, इसलिए मैं अंदाज़ा नहीं लगाऊँगा। हमारी टीम इसकी पुष्टि कर सकती है—Contact page या WhatsApp पर संदेश भेजें।`,
      }
      reply = {
        detectedIntent: 'UNVERIFIED_FACT',
        text: responses[language],
        actions: [
          { label: 'Contact the Team', href: '/contact' },
          { label: 'WhatsApp the Team', href: 'https://wa.me/917304645333' },
        ],
      }
    } else {
      const responses: Record<ConciergeLanguage, string> = {
        ENGLISH: `${hello} I’d love to hear more. What kind of art are you enjoying lately?`,
        HINGLISH: `${hello} Aapko kis tarah ki art pasand hai? Agar kisi exhibition ya visit ke baare mein baat karni ho, main yahin hoon.`,
        HINDI: `${hello} आपको किस तरह की कला पसंद है? अगर किसी प्रदर्शनी या विज़िट के बारे में बात करनी हो, मैं यहीं हूँ।`,
      }
      reply = { detectedIntent: 'GENERAL', text: responses[language], actions: [] }
    }
  }

  const previousReply = [...history].reverse().find((message) => message.sender === 'ASSISTANT')?.text ?? null
  return {
    ...reply,
    text: avoidImmediateRepeat(reply.text.trim(), previousReply, language, history.length),
  }
}

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

async function readMessages(leadIds: string[]) {
  if (!leadIds.length) return new Map<string, any[]>()
  const [rows] = await pool.query<any[]>(`
    SELECT id, lead_id leadId, sender, text, detected_intent detectedIntent, created_at createdAt
    FROM concierge_messages
    WHERE lead_id IN (${leadIds.map(() => '?').join(',')})
    ORDER BY sequence_id ASC`, leadIds)
  const messages = new Map<string, any[]>()
  for (const row of rows) {
    const list = messages.get(row.leadId) ?? []
    list.push({ ...row, createdAt: new Date(row.createdAt).toISOString() })
    messages.set(row.leadId, list)
  }
  return messages
}

conciergeRouter.post('/lead', leadLimit, async (req, res, next) => {
  try {
    const input = leadInput.parse(req.body)
    if (input.leadId && input.sessionToken) {
      const [existing] = await pool.query<any[]>(
        'SELECT id, source_page sourcePage, created_at createdAt FROM concierge_leads WHERE id=? AND session_token_hash=? LIMIT 1',
        [input.leadId, tokenHash(input.sessionToken)],
      )
      if (!existing[0]) return res.status(401).json({ error: 'This saved lead session is no longer valid. Please submit your details again.' })
      await pool.query(
        'UPDATE concierge_leads SET name=?, phone=?, email=?, role=?, consented_at=NOW() WHERE id=?',
        [input.name, input.phone, input.email, input.role, input.leadId],
      )
      return res.json({
        leadId: input.leadId,
        sessionToken: input.sessionToken,
        name: input.name,
        phone: input.phone,
        email: input.email,
        role: input.role,
        sourcePage: existing[0].sourcePage,
        createdAt: new Date(existing[0].createdAt).toISOString(),
      })
    }

    const leadId = crypto.randomUUID()
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const greeting = `Namaste, ${firstName(input.name)}! I’m THOA, your friendly art guide. What would you like to explore first?`
    await withTransaction(async (connection) => {
      await connection.query(`
        INSERT INTO concierge_leads
          (id, session_token_hash, name, phone, email, role, source_page, consented_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [leadId, tokenHash(sessionToken), input.name, input.phone, input.email, input.role, input.sourcePage])
      await connection.query(`
        INSERT INTO concierge_messages (id, lead_id, sender, text, detected_intent)
        VALUES (?, ?, 'ASSISTANT', ?, 'WELCOME')`,
      [crypto.randomUUID(), leadId, greeting])
    })
    const [createdRows] = await pool.query<any[]>('SELECT created_at createdAt FROM concierge_leads WHERE id=?', [leadId])
    res.status(201).json({
      leadId,
      sessionToken,
      name: input.name,
      phone: input.phone,
      email: input.email,
      role: input.role,
      sourcePage: input.sourcePage,
      createdAt: new Date(createdRows[0].createdAt).toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

conciergeRouter.post('/conversation', conversationLimit, async (req, res, next) => {
  try {
    const input = conversationInput.parse(req.body)
    const [leads] = await pool.query<any[]>(
      'SELECT id FROM concierge_leads WHERE id=? AND session_token_hash=? LIMIT 1',
      [input.leadId, tokenHash(input.sessionToken)],
    )
    if (!leads[0]) return res.status(401).json({ error: 'This saved lead session is no longer valid.' })
    const [rows] = await pool.query<any[]>(`
      SELECT id, sender, text, detected_intent detectedIntent, created_at createdAt
      FROM concierge_messages
      WHERE lead_id=?
      ORDER BY sequence_id ASC`, [input.leadId])
    res.set('Cache-Control', 'no-store')
    res.json({ messages: rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() })) })
  } catch (error) {
    next(error)
  }
})

const chatHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = messageInput.parse(req.body)
    const [leads] = await pool.query<any[]>(
      'SELECT name FROM concierge_leads WHERE id=? AND session_token_hash=? LIMIT 1',
      [input.leadId, tokenHash(input.sessionToken)],
    )
    if (!leads[0]) return res.status(401).json({ error: 'This saved lead session is no longer valid.' })

    const [historyRows] = await pool.query<any[]>(`
      SELECT sender, text, detected_intent detectedIntent
      FROM concierge_messages
      WHERE lead_id=?
      ORDER BY sequence_id DESC
      LIMIT 12`, [input.leadId])
    const history = (historyRows as ConversationMessage[]).reverse()
    const reply = await buildReply(input.text, leads[0].name, history)
    const userMessageId = crypto.randomUUID()
    const assistantMessageId = crypto.randomUUID()
    await withTransaction(async (connection) => {
      await connection.query(`
        INSERT INTO concierge_messages (id, lead_id, sender, text, detected_intent)
        VALUES (?, ?, 'USER', ?, ?)`,
      [userMessageId, input.leadId, input.text, reply.detectedIntent])
      await connection.query(`
        INSERT INTO concierge_messages (id, lead_id, sender, text, detected_intent)
        VALUES (?, ?, 'ASSISTANT', ?, ?)`,
      [assistantMessageId, input.leadId, reply.text, reply.detectedIntent])
    })
    res.status(201).json({
      userMessage: { id: userMessageId, sender: 'USER', text: input.text, detectedIntent: reply.detectedIntent, createdAt: new Date().toISOString() },
      assistantMessage: { id: assistantMessageId, sender: 'ASSISTANT', text: reply.text, detectedIntent: reply.detectedIntent, createdAt: new Date().toISOString(), actions: reply.actions },
    })
  } catch (error) {
    next(error)
  }
}

conciergeRouter.post('/chat', messageLimit, chatHandler)
conciergeRouter.post('/message', messageLimit, chatHandler)

conciergeRouter.get('/admin/leads', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const query = z.object({
      page: z.coerce.number().int().min(1).max(100_000).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(30),
      q: z.string().trim().max(120).default(''),
    }).parse(req.query)
    const search = `%${query.q}%`
    const where = query.q ? 'WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?' : ''
    const params = query.q ? [search, search, search] : []
    const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) total FROM concierge_leads ${where}`, params)
    const [leads] = await pool.query<any[]>(`
      SELECT id, name, phone, email, role, source_page sourcePage, created_at createdAt
      FROM concierge_leads
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`, [...params, query.pageSize, (query.page - 1) * query.pageSize])
    const messages = await readMessages(leads.map((lead) => lead.id))
    res.set('Cache-Control', 'no-store')
    res.json({
      leads: leads.map((lead) => ({
        ...lead,
        createdAt: new Date(lead.createdAt).toISOString(),
        messages: messages.get(lead.id) ?? [],
      })),
      total: Number(countRows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    })
  } catch (error) {
    next(error)
  }
})

conciergeRouter.get('/admin/export.csv', ...adminOnly, async (_req: AuthRequest, res, next) => {
  try {
    const [leads] = await pool.query<any[]>(`
      SELECT id, name, phone, email, role, source_page sourcePage, created_at createdAt
      FROM concierge_leads
      ORDER BY created_at DESC, id DESC`)
    const messages = await readMessages(leads.map((lead) => lead.id))
    const lines = [
      ['Lead ID', 'Name', 'Phone', 'Email', 'Role', 'Source Page', 'Created At', 'Conversation'].map(csvCell).join(','),
      ...leads.map((lead) => {
        const transcript = (messages.get(lead.id) ?? [])
          .map((message) => `${message.sender}: ${message.text}`)
          .join('\n')
        return [
          lead.id, lead.name, lead.phone, lead.email, lead.role, lead.sourcePage,
          new Date(lead.createdAt).toISOString(), transcript,
        ].map(csvCell).join(',')
      }),
    ]
    res.set({
      'Cache-Control': 'no-store',
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="thoa-leads.csv"',
    })
    res.send(`\uFEFF${lines.join('\r\n')}`)
  } catch (error) {
    next(error)
  }
})

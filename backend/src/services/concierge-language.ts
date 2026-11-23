export type ConciergeLanguage = 'ENGLISH' | 'HINGLISH' | 'HINDI'
export type ConciergeIntent =
  | 'GREETING'
  | 'PLATFORM'
  | 'MENTOR_STORY'
  | 'EDITION_STATS'
  | 'STALL_BOOKING'
  | 'VISITOR_PASSES'
  | 'UPCOMING_EXHIBITIONS'
  | 'ARTIST_SUPPORT'
  | 'BRAND_PARTNERSHIP'
  | 'ART_ENGAGEMENT'
  | 'APPRECIATION'
  | 'GENERAL'

export const leadershipRoster: Record<ConciergeLanguage, string> = {
  ENGLISH: 'The Haat of Art Foundation is headquartered in Andheri West, Mumbai. Our leadership includes Mentor: Vinod Dara Singh; Founder & CEO: Anil Kumar B. G.; Co-Founder: Mita V. Agarwal; Chairman: L. Sankar Ramakrishnan; Director - Operations: Ravi Gupta; and Director - Programs: Priya Menon. Together, they empower emerging, established and specially-abled Indian artists through inclusive exhibitions, visibility and meaningful connections with collectors.',
  HINGLISH: 'The Haat of Art Foundation ka headquarters Andheri West, Mumbai mein hai. Hamari leadership mein Mentor: Vinod Dara Singh; Founder & CEO: Anil Kumar B. G.; Co-Founder: Mita V. Agarwal; Chairman: L. Sankar Ramakrishnan; Director - Operations: Ravi Gupta; aur Director - Programs: Priya Menon hain. Yeh team emerging, established aur specially-abled Indian artists ko inclusive exhibitions, visibility aur collectors se meaningful connections dene ke liye kaam karti hai.',
  HINDI: 'The Haat of Art Foundation का मुख्यालय अंधेरी वेस्ट, मुंबई में है। हमारी leadership में Mentor: Vinod Dara Singh; Founder & CEO: Anil Kumar B. G.; Co-Founder: Mita V. Agarwal; Chairman: L. Sankar Ramakrishnan; Director - Operations: Ravi Gupta; और Director - Programs: Priya Menon शामिल हैं। यह टीम emerging, established और specially-abled भारतीय कलाकारों को inclusive exhibitions, पहचान और collectors से सार्थक जुड़ाव देने के लिए काम करती है।',
}

export function detectConciergeLanguage(text: string): ConciergeLanguage {
  if (/[\u0900-\u097f]/.test(text)) return 'HINDI'
  if (/\b(?:kya|kaise|hai|hain|h|ho|aap|apne|bata|sakte|sakta|sakti|ke|bare|mein|me|kab|kaun|kitna|kitni|kitne|log|kare|karna|chahiye|mujhe|bhai|haan|paise|agla|namaste|namaskar|shukriya|dhanyavaad|bore|mazedaar|majedar|timepass|time\s*pass|kuch|karne|ji|aur|uska|uske|iska|iske|metor)\b/i.test(text)) {
    return 'HINGLISH'
  }
  return 'ENGLISH'
}

const greetingPattern = /^(?:hi+|hello+|hey+|namaste|namaskar|नमस्ते|नमस्कार)[\s,!.?]*$/i
const checkInPattern = /^(?:(?:hi+|hello+|hey+|namaste|namaskar|नमस्ते|नमस्कार)[\s,!.?]+)?(?:kaise\s+(?:ho|hain|hai)(?:\s+(?:aap|bhai|yaar))?|kya\s+haal(?:\s+(?:hai|hain))?(?:\s+chaal)?(?:\s+(?:aap|bhai|yaar))?|how\s+are\s+you(?:\s+doing)?|how'?s\s+it\s+going|how\s+have\s+you\s+been|what'?s\s+up|what\s+are\s+you\s+up\s+to|कैसे\s+(?:हो|हैं)|क्या\s+हाल(?:\s+(?:है|हैं))?)[\s,!.?؟]*$/i

export function isConciergeCheckIn(text: string) {
  return checkInPattern.test(text.trim().replace(/\s+/g, ' '))
}

export function shouldSendGreeting(history: readonly { sender: 'USER' | 'ASSISTANT' }[]) {
  return !history.some((message) => message.sender === 'ASSISTANT')
}

export function isSpecificFactualQuestion(text: string) {
  const query = text.trim()
  if (!query || isConciergeCheckIn(query)) return false
  if (/\b(?:can|could|would)\s+you\s+(?:help|chat|talk|listen)\b/i.test(query)) return false
  const asksSpecificFact = /\b(?:date|time|price|cost|fee|tariff|rate|address|phone|email|contact|venue|location|parking|availability|opening|closing|hours|open|close|age|capacity|duration|schedule|deadline|name|number|free|entry|pass|city|state|year|policy|permission)\b/i.test(query)
    || /(?:तारीख|समय|कीमत|शुल्क|पता|फोन|ईमेल|वेन्यू|जगह|पार्किंग|समय|उपलब्ध|नाम|संख्या|अनुमति)/.test(query)
  const startsWithFactQuestion = /^(?:who|when|where|which|whose|how many|how much|how long|how old|how far|what time)\b/i.test(query)
    || /^(?:kab|kahan|kahaan|kaun|kaunsa|kaunsi|kitna|kitni|kitne|kis(?:ka|ki|ke)?)\b/i.test(query)
    || /(?:कब|कहाँ|कहां|कौन|कितना|कितनी|कितने|किसका|किसकी|किसके)/.test(query)
  const asksSpecificQuestion = /^(?:what|why|how|is|are|does|do|did|can|could|will|would|has|have|kya)\b/i.test(query)
    || /(?:क्या|कैसे|किस जगह)/.test(query)
    || /[?؟]\s*$/.test(query)
  return startsWithFactQuestion || asksSpecificQuestion && asksSpecificFact
}

export function detectConciergeIntent(text: string): ConciergeIntent {
  const query = text.trim().toLowerCase()
  if (greetingPattern.test(query) || isConciergeCheckIn(query)) return 'GREETING'
  if (/^(?:thanks?|thank you(?: so much)?|thx|shukriya|dhanyavaad|धन्यवाद|शुक्रिया)[\s,!.?]*$/i.test(query)) return 'APPRECIATION'
  const visitorQuery = query.replace(/\btime[- ]?pass\b/gi, '').replace(/टाइम\s*पास/g, '')
  if (/\b(?:visitor|visitors|pass(?:es)?|ticket|vip|entry|qr|workshop|darshak|pravesh)\b/i.test(visitorQuery)
    || /(?:पास|टिकट|दर्शक|प्रवेश|वीआईपी|वर्कशॉप)/.test(visitorQuery)) return 'VISITOR_PASSES'
  if (/^(?:about(?: us)?|who are you|who runs the haat)\??$/.test(query)
    || /\b(?:mentor|metor|founder|owner|foundation|leadership|mission|story)\b/i.test(query)
    || /\b(?:vinod dara singh|anil kumar(?: b\.? g\.?)?|mita(?: v\.?)? agarwal|l\.? sankar ramakrishnan|sankar ramakrishnan|ravi gupta|priya menon)\b/i.test(query)
    || /(?:गुरु|मार्गदर्शक|संस्थापक|नेतृत्व|मिशन|कहानी|परिचय)/.test(query)) return 'MENTOR_STORY'
  if (/\b(?:website|platform|how (?:does )?(?:the )?(?:site|website|platform)|how thoa works|kaise work|kya hota|bata sakte|kya hai thoa|tell me about thoa|about the haat|about the website)\b/i.test(query)
    || /(?:वेबसाइट|प्लेटफ़ॉर्म|कैसे काम|क्या है|के बारे)/.test(query)) return 'PLATFORM'
  if (/\b(?:stall|stalls|booth|tariff|pricing|price|fees?|charges?|cost|kitna|kitni|paise|kaise book|book.*stall|stall.*book|exhibit)\b/i.test(query)
    || /(?:स्टॉल|बुक|कीमत|शुल्क|कितना|कितनी|पैसे)/.test(query)) return 'STALL_BOOKING'
  if (/\b(?:upcoming|next|nearest|dates?|schedule|when|kab|agla|aane wali|kahan|show|event|pradarshani)\b/i.test(query)
    || /(?:प्रदर्शनी|अगली|कब|तारीख|शहर|कहाँ)/.test(query)) return 'UPCOMING_EXHIBITIONS'
  if (/\b(?:edition|eddition|2022|2023|2024|2025|2026|2027|participate|participation|participants|statistics|stats|milestone|kitne log|how many|artworks sold|exhibitors)\b/i.test(query)
    || /(?:एडिशन|संस्करण|भाग लिया|कितने लोग|कितने कलाकार)/.test(query)) return 'EDITION_STATS'
  if (/\b(?:exhibition|exhibitions|city|shehar)\b/i.test(query)
    || /(?:प्रदर्शनी|शहर)/.test(query)) return 'UPCOMING_EXHIBITIONS'
  if (/\b(?:artist|disabled|disability|accessible|accessibility|support|inclusive|logistics|portfolio|kalakar|sahayata)\b/i.test(query)
    || /(?:कलाकार|दिव्यांग|सहायता|सुलभता)/.test(query)) return 'ARTIST_SUPPORT'
  if (/\b(?:brand|sponsor|sponsorship|partner|partnership|venue|corporate|saajhedari)\b/i.test(query)
    || /(?:ब्रांड|प्रायोजन|साझेदारी|स्थल)/.test(query)) return 'BRAND_PARTNERSHIP'
  if (/\b(?:bored|boring|bore|time[- ]?pass|sketch(?:ing)?(?:\s+(?:prompts?|ideas?))?|drawing prompts?|doodle challenges?|art prompts?|creative prompts?|art trivia|(?:colou?r\s+)?palettes?(?:\s+ideas?)?|creative warm[- ]?up|fun art prompts?|another prompt|one more prompt|art game)\b/i.test(query)
    || /\b(?:kuch\s+(?:mazedaar|majedar|karne\s+ko)|bore\s+ho(?:\s+raha|\s+rahi)?|time\s+pass)\b/i.test(query)
    || /(?:बोर|टाइम\s*पास|समय\s*बिताने|कुछ\s+(?:मज़ेदार|मजेदार)|स्केच|चित्र\s+बनाने|रंगों?\s+(?:का|की)\s+पैलेट)/.test(query)) return 'ART_ENGAGEMENT'
  return 'GENERAL'
}

export function inferFollowUpIntent(text: string, previousIntent: string | null): ConciergeIntent {
  const intent = detectConciergeIntent(text)
  const knownPreviousIntents: ConciergeIntent[] = [
    'PLATFORM', 'MENTOR_STORY', 'EDITION_STATS', 'STALL_BOOKING', 'VISITOR_PASSES', 'UPCOMING_EXHIBITIONS', 'ARTIST_SUPPORT', 'BRAND_PARTNERSHIP', 'ART_ENGAGEMENT',
  ]
  const contextualIntent = knownPreviousIntents.find((candidate) => candidate === previousIntent)
  if (intent !== 'GENERAL' || !contextualIntent) return intent
  if (/\b(?:and|also|more|details|what about|tell me more|that|there|same|again|another|one more|next one|aur|uska|uske|iska|iske|iska kya|aur bata|ek aur|agla prompt)\b/i.test(text)
    || /(?:और बताइए|उसके बारे में|इसकी जानकारी|एक और|अगला प्रॉम्प्ट)/.test(text)) return contextualIntent
  return intent
}

const repeatPrompts: Record<ConciergeLanguage, string[]> = {
  ENGLISH: [
    'I’m right here with you—tell me which city or exhibition you have in mind.',
    'Happy to keep helping. What would you like to explore next?',
  ],
  HINGLISH: [
    'Main yahin hoon—apna preferred city ya exhibition bataiye, main aage guide karunga.',
    'Bilkul, aap jo detail chahte hain woh poochhiye—main help karta hoon.',
  ],
  HINDI: [
    'मैं यहीं हूँ—अपना पसंदीदा शहर या प्रदर्शनी बताइए, मैं आगे मार्गदर्शन करूँगा।',
    'ज़रूर, अगली जानकारी पूछिए—मैं आपकी मदद के लिए यहीं हूँ।',
  ],
}

export function avoidImmediateRepeat(reply: string, previousReply: string | null, language: ConciergeLanguage, turnCount: number) {
  if (!previousReply || reply !== previousReply) return reply
  const prompts = repeatPrompts[language]
  for (let offset = 0; offset < prompts.length; offset += 1) {
    const candidate = `${reply}\n\n${prompts[(turnCount + offset) % prompts.length]}`
    if (candidate !== previousReply) return candidate
  }
  return `${reply}\n\n${prompts[0]}`
}

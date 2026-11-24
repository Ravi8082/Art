import Link from 'next/link'

const notices = {
  privacy: {
    title: 'Privacy Policy',
    copy: 'Optional first-party analytics is off until you allow it in Privacy settings. If enabled, we record a random browser ID, traffic source, visited public pages and basic link/form actions for up to 90 days; our analytics database does not store raw IP addresses or form contents. Meta advertising is a separate choice and remains off unless you allow it. When enabled and configured, Meta may receive page-view and lead events and browser/network information, including IP address, to measure ads and build retargeting audiences; contact details and form contents are not sent to Meta. Contact-form details are used to answer your enquiry. Exhibition emails and WhatsApp promotions are optional, use separate checkboxes, and can be declined. You can change analytics and Meta choices in Privacy settings. This summary is not a complete legal notice; contact our team with privacy questions.',
  },
  terms: {
    title: 'Terms & Conditions',
    copy: 'The approved terms and conditions are being prepared for publication. This page is not yet a complete legal notice. For current event, stall-booking, or participation terms, please contact our team before proceeding.',
  },
} as const

export function LegalNoticePage({ kind }: { kind: keyof typeof notices }) {
  const notice = notices[kind]
  return (
    <section className="legal-notice-page" aria-labelledby="legal-notice-title">
      <span className="th-eyebrow">Legal information</span>
      <h1 id="legal-notice-title">{notice.title}</h1>
      <p>{notice.copy}</p>
      <Link href="/contact">Contact our team</Link>
    </section>
  )
}

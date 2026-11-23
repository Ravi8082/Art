import Link from 'next/link'

const notices = {
  privacy: {
    title: 'Privacy Policy',
    copy: 'The approved privacy policy is being prepared for publication. This page is not yet a complete legal notice. If you have questions about personal information you have shared with us, please contact our team.',
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

import Link from 'next/link'
import { SafeImage } from '@/components/home/safe-image'
import { ARTIST_DEMO_NOTE, adminNav, adminRows, artistBenefits, artistNav, artworks, dashStats, plans, profileStats, profileTabs, stepNames } from '@/lib/demo-artist'

const Logo = () => <Link href="/" className="ar-logo"><img src="/media/logo.png" alt="The Haat of Art" /></Link>
export const DemoNote = () => <p className="th-demo-note">{ARTIST_DEMO_NOTE}</p>
const pill = (s: string) => s.toLowerCase().includes('pend') ? 'is-pend' : s.toLowerCase().includes('rej') ? 'is-rej' : 'is-ok'

export function ArtistHero() {
  return (
    <section className="ar-hero">
      <SafeImage src="/demo/ind-main.jpg" alt="Artist with painting (demo image)" className="ar-hero-img" />
      <div className="ar-hero-text">
        <h1>Showcase<br />Your Art to<br />a Wider Audience</h1>
        <p>Create your artist profile, share your artworks and be part of The Haat of Art community.</p>
        <Link className="th-btn" href="/artist/register">Join as an Artist →</Link>
      </div>
      <div className="ar-benefits">{artistBenefits.map((b) => <div key={b.title}><i>{b.icon}</i><b>{b.title}</b><small>{b.sub}</small></div>)}</div>
    </section>
  )
}

export function Steps({ active }: { active: 1 | 2 | 3 }) {
  return (
    <ol className="ar-steps">
      {stepNames.map((n, i) => <li key={n} className={i + 1 < active ? 'is-done' : i + 1 === active ? 'is-on' : ''}><i>{i + 1 < active ? '✓' : i + 1}</i><span>{n}</span></li>)}
    </ol>
  )
}

export function AuthCard({ step, children, wide }: { step: 1 | 2 | 3; children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="ar-auth">
      <div className={wide ? 'ar-card is-wide' : 'ar-card'}>
        <Logo />
        <Steps active={step} />
        {children}
      </div>
      <DemoNote />
    </main>
  )
}

const Field = ({ label, ph, type = 'text', req }: { label: string; ph?: string; type?: string; req?: boolean }) => (
  <label className="ar-field"><span>{label}{req && <em> *</em>}</span><input type={type} placeholder={ph} /></label>
)

export function RegisterForm() {
  return (
    <AuthCard step={1}>
      <h2>Create Your Artist Account</h2>
      <p className="ar-sub">Join our community and start your journey.</p>
      <form className="ar-form" action="/artist/verify">
        <Field label="Full Name" ph="Enter your full name" req />
        <Field label="Email Address" ph="Enter your email address" type="email" req />
        <Field label="Password" ph="Create a strong password" type="password" req />
        <label className="ar-check"><input type="checkbox" /> I agree to the <Link href="/contact">Terms &amp; Conditions</Link> and <Link href="/contact">Privacy Policy</Link></label>
        <button className="th-btn ar-wide" type="submit">Send OTP →</button>
      </form>
      <p className="ar-foot">Already have an account? <Link href="/artist/dashboard">Sign In</Link></p>
      <p className="ar-mini">Demo only — nothing is saved or sent.</p>
    </AuthCard>
  )
}

export function VerifyForm() {
  return (
    <AuthCard step={2}>
      <div className="ar-mail" aria-hidden="true">✉</div>
      <h2>Verify Your Email</h2>
      <p className="ar-sub">We have sent a 6-digit OTP to<br /><b>yourname@example.com</b></p>
      <div className="ar-otp">{['4', '7', '2', '9', '1', '0'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <p className="ar-mini">OTP will expire in <b>4:52 minutes</b></p>
      <p className="ar-links"><Link href="/artist/verify">Resend OTP (00:28)</Link><Link href="/artist/register">Change Email</Link></p>
      <Link className="th-btn ar-wide" href="/artist/profile-setup">Verify &amp; Continue →</Link>
      <p className="ar-mini">Demo only — no email is actually sent.</p>
    </AuthCard>
  )
}

export function ProfileSetup() {
  return (
    <AuthCard step={3} wide>
      <h2 className="ar-left">Tell Us About Yourself</h2>
      <p className="ar-sub ar-left">Set up your artist profile. You can update this later.</p>
      <form className="ar-form" action="/artist/dashboard">
        <div className="ar-prof-top"><SafeImage src="/demo/artist1.jpg" alt="Profile photo (demo)" /><div><Field label="Artist Name" ph="Priya Sharma" req /><Field label="City" ph="Mumbai" req /></div></div>
        <div className="ar-field"><span>Art Categories<em> *</em></span><div className="ar-chips"><b>Painting ×</b><b>Mural ×</b><b>Mixed Media ×</b></div></div>
        <label className="ar-field"><span>Short Bio<em> *</em></span><textarea rows={3} placeholder="I am a contemporary artist inspired by Indian culture, nature and modern expression." /></label>
        <Field label="Website / Portfolio (Optional)" ph="https://" />
        <button className="th-btn ar-wide" type="submit">Save &amp; Continue →</button>
      </form>
    </AuthCard>
  )
}

export function PanelShell({ variant, active, title, sub, action, children }: { variant: 'artist' | 'admin'; active: string; title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  const nav: ReadonlyArray<readonly [string, string]> = variant === 'artist' ? artistNav : adminNav.map((n) => [n, '/admin-demo/artworks'] as const)
  return (
    <div className={`ar-panel is-${variant}`}>
      <aside className="ar-side">
        <Logo />
        <div className="ar-user"><SafeImage src="/demo/artist1.jpg" alt="" /><span><b>Priya Sharma</b><small>{variant === 'artist' ? 'Artist' : 'Super Admin'}</small></span></div>
        <nav>{nav.map(([n, href]) => <Link key={n} href={href} className={n === active ? 'is-active' : ''}>{n}</Link>)}</nav>
      </aside>
      <section className="ar-main">
        <header className="ar-main-head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{action}</header>
        {children}
        <DemoNote />
      </section>
    </div>
  )
}

export function ArtistDashboard() {
  return (
    <PanelShell variant="artist" active="Dashboard" title="Welcome, Priya!" sub="Here’s a summary of your artist account." action={<Link className="th-btn-outline" href="/artist/profile">View Profile</Link>}>
      <div className="ar-stats">{dashStats.map(([n, l]) => <div key={l}><b>{n}</b><span>{l}</span></div>)}</div>
      <div className="ar-banner"><span>⚠ You have used 2 free artwork listings. Upgrade to a paid plan to add more artworks.</span><Link className="th-btn" href="/artist/plans">View Plans →</Link></div>
      <div className="ar-row-head"><h3>Recent Artworks</h3><Link href="/artist/artworks/new">View All →</Link></div>
      <div className="ar-art-grid">{artworks.map((a) => <article key={a.slug}><SafeImage src={a.image} alt={`${a.title} (demo image)`} /><b>{a.title}</b><small>{a.category}</small><span className={`ar-pill ${pill(a.status)}`}>{a.status}</span></article>)}</div>
    </PanelShell>
  )
}

export function AddArtwork() {
  return (
    <PanelShell variant="artist" active="Add New Artwork" title="Add New Artwork" sub="Share your creativity with the world. (Free slots used: 2/2)">
      <form className="ar-form ar-art-form" action="/artist/dashboard">
        <div className="ar-field"><span>Artwork Images <small>(JPG, PNG, WebP; max 5MB each)</small></span>
          <div className="ar-uploads"><div className="ar-drop">⬆<b>Click to upload images</b><small>or drag and drop</small></div>{['art-lotus', 'art-dusk', 'art-tree'].map((s) => <SafeImage key={s} src={`/demo/${s}.jpg`} alt="Upload preview (demo)" />)}<div className="ar-drop is-add">+</div></div></div>
        <div className="ar-field"><span>Artwork Video (Optional)</span><div className="ar-video"><button type="button" className="th-btn-outline">Upload Video</button><input placeholder="Paste YouTube Link (https://)" /></div></div>
        <div className="ar-cols"><Field label="Title" ph="Enter artwork title" req /><Field label="Category" ph="Select category" req /><Field label="Medium" ph="e.g. Acrylic, Watercolor" /><Field label="Dimensions" ph="e.g. 24 x 36 inches" /></div>
        <div className="ar-cols"><Field label="Year" ph="e.g. 2024" /><Field label="Price (Optional)" ph="₹ 0.00" /></div>
        <label className="ar-field"><span>Description</span><textarea rows={5} placeholder="Write about your artwork, inspiration, techniques, etc." /></label>
        <div className="ar-actions"><button type="button" className="th-btn-outline">Save as Draft</button><button type="submit" className="th-btn">Submit for Review →</button></div>
      </form>
    </PanelShell>
  )
}

export function PlansPage() {
  return (
    <main className="ar-plans">
      <Logo />
      <h1>Upgrade Your Artist Plan</h1>
      <p className="ar-sub">You have used your <b>2 free artwork</b> listings. Choose a plan to add more artworks and unlock additional benefits.</p>
      <div className="ar-toggle"><b>Monthly</b><span>Yearly <small>Save up to 20%</small></span></div>
      <div className="ar-plan-grid">
        {plans.map((p) => (
          <div key={p.name} className={`ar-plan${p.rec ? ' is-rec' : ''}`}>
            {p.rec && <em>Recommended</em>}
            <h3>{p.name}</h3>
            <div className="ar-price"><b>{p.price}</b><span>{p.per}</span></div>
            <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
            {p.current ? <span className="ar-plan-cur">{p.cta}</span> : <Link className="th-btn ar-wide" href="/contact">{p.cta}</Link>}
          </div>
        ))}
      </div>
      <p className="ar-mini">Demo prices — payments are not connected. All plans are subject to our <Link href="/contact">Terms &amp; Conditions</Link>. Prices shown are sample values.</p>
      <DemoNote />
    </main>
  )
}

export function ArtistProfile() {
  return (
    <>
      <section className="ap-cover"><SafeImage src="/demo/hl-wall.jpg" alt="Cover artwork (demo image)" /></section>
      <section className="ap-head">
        <SafeImage src="/demo/artist1.jpg" alt="Priya Sharma (demo)" className="ap-photo" />
        <div className="ap-info"><h1>Priya Sharma <em>✔ Verified Artist</em></h1><p className="ap-loc">📍 Mumbai, Maharashtra</p><p>I am a contemporary artist inspired by Indian culture, nature and modern expression. My work explores the beauty of everyday life through colors, textures and mixed media.</p></div>
        <Link className="th-btn" href="/contact">Contact Artist</Link>
      </section>
      <section className="ap-stats">{profileStats.map(([n, l]) => <div key={l}><b>{n}</b><small>{l}</small></div>)}</section>
      <nav className="ap-tabs">{profileTabs.map((t, i) => <span key={t} className={i === 0 ? 'is-on' : ''}>{t}</span>)}</nav>
      <section className="ap-grid">{artworks.map((a) => <article key={a.slug}><SafeImage src={a.image} alt={`${a.title} (demo image)`} /><b>{a.title}</b><small>{a.medium}</small><strong>{a.price}</strong></article>)}</section>
    </>
  )
}

export function AdminArtworks() {
  return (
    <PanelShell variant="admin" active="Artworks" title="Artwork Submissions" sub="Review and approve artist artworks.">
      <div className="ar-tabs"><b>All (24)</b><span>Pending (8)</span><span>Approved (12)</span><span>Rejected (4)</span><input placeholder="Search by title, artist or category..." aria-label="Search" /></div>
      <div className="ar-table-wrap">
        <table className="ar-table"><thead><tr><th>#</th><th>Artwork</th><th>Title</th><th>Artist</th><th>Category</th><th>Submitted On</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{adminRows.map((r) => <tr key={r.id}><td>{r.id}</td><td><SafeImage src={r.image} alt="" /></td><td>{r.title}</td><td>{r.artist}</td><td>{r.category}</td><td>{r.date}</td><td><span className={`ar-pill ${pill(r.status)}`}>{r.status}</span></td><td><Link className="th-btn-outline" href="/admin-demo/artworks/review">{r.status === 'Pending' ? 'Review' : 'View'}</Link></td></tr>)}</tbody></table>
      </div>
    </PanelShell>
  )
}

export function AdminReview() {
  const a = artworks[0]
  return (
    <PanelShell variant="admin" active="Artworks" title="Colors of Mumbai" sub="By Priya Sharma | Submitted on 12 Oct 2025" action={<Link href="/admin-demo/artworks" className="th-btn-outline">← Back to Submissions</Link>}>
      <div className="ar-review">
        <div>
          <SafeImage src={a.image} alt="Colors of Mumbai (demo image)" className="ar-review-img" />
          <div className="ar-thumbs">{['art-bloom', 'art-lotus', 'art-dusk'].map((s) => <SafeImage key={s} src={`/demo/${s}.jpg`} alt="" />)}</div>
          <dl className="ar-dl"><dt>Category</dt><dd>Painting</dd><dt>Medium</dt><dd>Acrylic on Canvas</dd><dt>Dimensions</dt><dd>24 x 36 inches</dd><dt>Year</dt><dd>2024</dd><dt>Price</dt><dd>₹ 15,000</dd></dl>
          <p className="ap-desc"><b>Description</b><br />A vibrant painting inspired by the colors, energy and life of Mumbai. It captures the mood of tradition and modernity through colorful strokes.</p>
        </div>
        <aside className="ar-action">
          <h4>Review Action</h4>
          <Link className="ar-btn is-green" href="/admin-demo/artworks">Approve &amp; Publish</Link>
          <Link className="ar-btn is-amber" href="/admin-demo/artworks">Request Changes</Link>
          <Link className="ar-btn is-red" href="/admin-demo/artworks">Reject</Link>
          <label className="ar-field"><span>Add comments (required for reject or changes)</span><textarea rows={4} placeholder="Enter your review comments..." /></label>
          <Link className="th-btn ar-wide" href="/admin-demo/artworks">Submit Review</Link>
        </aside>
      </div>
    </PanelShell>
  )
}

export function EmailPreviews() {
  const mail = (ok: boolean) => (
    <div className="ar-mail-col">
      <h3 className={ok ? 'is-ok' : 'is-rej'}><i>{ok ? '✓' : '✕'}</i> {ok ? 'Blog/Artwork Approved Email to Artist' : 'Blog/Artwork Rejected Email to Artist'}</h3>
      <div className="ar-mail-card">
        <Logo />
        <h4>{ok ? 'Your Artwork Has Been Approved!' : 'Update on Your Artwork Submission'}</h4>
        <p>Hi Priya Sharma,</p>
        {ok ? <p>We’re happy to inform you that your artwork <b>“Colors of Mumbai”</b> has been approved and is now live on The Haat of Art.</p>
          : <><p>Your artwork <b>“Urban Reflections”</b> has not been approved at this time.</p><div className="ar-reason"><b>Reason for Rejection</b><br />The image quality is low. Please upload a higher resolution image and resubmit.</div></>}
        <Link className="th-btn" href="/artist/dashboard">{ok ? 'View Your Artwork' : 'Edit & Resubmit'}</Link>
        <p>{ok ? 'Keep creating and sharing your amazing art.' : 'If you have questions, contact support.'}</p>
        <p>Team<br />The Haat of Art</p>
      </div>
    </div>
  )
  return (
    <main className="ar-emails"><h1>Email Notifications (Artist)</h1><div className="ar-mail-grid">{mail(true)}{mail(false)}</div><DemoNote /></main>
  )
}

# Production readiness audit

## Scope and method

- Audited the Next.js 16 / React 19 frontend and Express 5 / MySQL backend structure, shared UI, route metadata, global styles, assets, and the existing production-build configuration.
- Captured 228 full-page screenshots: 56 application routes plus one deliberate not-found probe, at mobile (375×812), tablet (768×1024), laptop (1366×768), and desktop (1920×1080). Raw captures and machine-readable findings are in `screenshots/before/`.
- Baseline Lighthouse run: homepage, mobile emulation, local production server on port 3001.
- The final homepage redesign has fresh full-page captures at all four requested sizes in `screenshots/after/home-*.png`. Other after-folder routes remain from the earlier partial capture and are not post-redesign verification.
- The pre-existing development server on port 3000 was left running. The isolated audit server on port 3001 is not the production deployment.

## Baseline

| Area | Finding |
|---|---|
| Lighthouse | Performance 73, Accessibility 87, Best Practices 96, SEO 100 |
| Core Web Vitals | LCP 5.1 s, TBT 360 ms, CLS 0 |
| Page checks | No horizontal overflow, broken images, or missing image alt text across captured route/device combinations |
| H1 checks | No H1 on `/artist/profile-setup`, `/artist/register`, `/artist/verify`, and `/dashboard/site-design` |
| Internal links | `/contact` contains a dead `/partners` link (404) |
| Touch targets | 3,744 targets under 44×44 px across all captures; this is a repeated route/device aggregate, not a count of unique controls |
| Browser/network logs | 1,380 logged events across runs; many are repeated API/CORS and analytics requests from using port 3001 while the backend is configured for port 3000. These must not be treated as 1,380 independent application defects. |

## Findings and remediation

### High

1. **Mobile users cannot zoom** — the root viewport sets `userScalable: false`. This prevents pinch zoom and fails an accessibility requirement.
2. **Homepage contrast is below WCAG AA** — Lighthouse reports brand-orange text and white-on-orange controls at 3.58–3.71:1, below 4.5:1 for the tested text sizes.
3. **Homepage carousel controls are too small** — the slide selectors are 7×7 px and Lighthouse reports inadequate target spacing.
4. **Homepage critical media loads inefficiently** — the hero images use lazy loading despite being in the initial viewport; the intro video autoplays and preloads its media. Lighthouse estimates 383 KiB of image-delivery savings and 598 KiB of cache savings.
5. **Root canonical metadata is inherited by unrelated routes** — `app/layout.tsx` declares `/` as the canonical for the whole application; several routes without their own canonical can therefore point search engines at the homepage.
6. **Global CSS is shipped broadly** — the root layout imports both `home.css` and `role-dashboard.css`. Lighthouse identifies about 57 KiB of unused CSS on the homepage; `home.css` and `role-dashboard.css` are roughly 184 KB and 136 KB before compression.
7. **Public sitemap is incomplete** — `app/sitemap.ts` lists 12 static URLs and does not include published event or blog-detail URLs.
8. **Analytics is requested outside its hosting environment** — the production build renders Vercel Analytics unconditionally, producing a missing `/_vercel/insights/script.js` request on the local non-Vercel server.

### Medium

1. **Broken partnership CTA** — `/contact` links to the nonexistent `/partners` route.
2. **Landmark semantics are incorrect** — `PublicShell` puts its header, page content, and footer inside one `<main>` element.
3. **An accessible-name mismatch exists in the social footer** — Lighthouse flags the LinkedIn link because its visible `in` text is not included in its ARIA name.
4. **Logo images lack intrinsic dimensions** — Lighthouse flags both shared logo instances, which can contribute to layout shift.
5. **Four pages have no H1** — three artist account flows and `/dashboard/site-design`; add a contextual page heading where appropriate.
6. **The custom not-found experience is absent** — the captured not-found probe returns the framework fallback rather than a branded, navigable page.
7. **Local capture has environment noise** — the backend allows the established `localhost:3000` origin, but the isolated production capture uses `localhost:3001`; API CORS/network failures and local Vercel Analytics 404s skew the raw error totals.

### Low / follow-up

1. **Legal destinations are placeholders** — footer privacy, terms, cancellation, artist-agreement, cookie, and accessibility links all point to `/contact`. The correct legal text and policy ownership require business/legal review, not invented content.
2. **Security headers can be strengthened** — existing headers include HSTS, frame, MIME, referrer, and permissions policies; a Content Security Policy is not configured and needs a nonce-compatible rollout.
3. **Performance and scale need deployment validation** — the site relies on the configured host/CDN and backend capacity; production cache headers, database-pool behavior, load testing, and distributed rate limiting must be confirmed against the actual hosting environment.
4. **Large source images need a delivery strategy** — `next.config.mjs` disables Next image optimization. Validate the backend image pipeline/CDN before enabling optimization for user-uploaded and remote media.

## Route inventory

The capture script discovered these 56 application routes; bracketed IDs are represented by stable sample values during capture:

`/`, `/about`, `/admin-demo/artworks`, `/admin-demo/artworks/review`, `/artist`, `/artist/artworks/new`, `/artist/bookings`, `/artist/dashboard`, `/artist/emails`, `/artist/plans`, `/artist/profile`, `/artist/profile-setup`, `/artist/register`, `/artist/verify`, `/artists`, `/artists/[id]`, `/artists/u/[userId]`, `/blog`, `/blog/[id]`, `/book-your-stall`, `/contact`, `/dashboard`, `/dashboard/about`, `/dashboard/artist-approvals`, `/dashboard/audit`, `/dashboard/blog-approvals`, `/dashboard/bookings`, `/dashboard/check-in`, `/dashboard/contact-page`, `/dashboard/content`, `/dashboard/enquiries`, `/dashboard/events`, `/dashboard/finance`, `/dashboard/guests`, `/dashboard/homepage-media`, `/dashboard/passes`, `/dashboard/profile`, `/dashboard/reports`, `/dashboard/site-design`, `/dashboard/stalls`, `/dashboard/system`, `/dashboard/team`, `/dashboard/users`, `/dashboard/visitors`, `/exhibit-with-us`, `/exhibitions`, `/exhibitions/events`, `/gallery`, `/highlights`, `/indore`, `/login`, `/newsletter/unsubscribe`, `/pass/[slug]`, `/password-reset`, `/visitor/pass/[token]`, `/visitor/register`.

## Fix log

| Problem | Change | Why |
|---|---|---|
| Initial findings recorded above | Homepage remediation and comparison are recorded below; full-site after-capture and performance work remain outstanding. | Preserve the stable baseline and distinguish verified homepage changes from incomplete site-wide follow-up. |
| Homepage looked like a collage of unrelated/demo sections | Reordered it into hero, quick links, about, upcoming/past events, artists, blog, and gallery; replaced the cartoon footer artwork with the existing neutral footer surface. | Follow the supplied reference layout without replacing the site's logo, palette, font pairing, or existing content. |
| Homepage showed stale or placeholder records | Read homepage copy/media from CMS APIs, future events from the events API, approved artists from the artist API, and blogs/partners from published content; omit expired events and duplicate/demo blog titles. | Keep editable content database-backed while avoiding obvious sample content. Local photos are used only as image fallbacks when editorial media is missing. |
| Wide event cards and image rows felt sparse | Used the database event description in the featured card, added a past-event highlight and a responsive gallery strip, and retained the existing CTA destinations. | Use existing admin-managed records to create a more deliberate editorial rhythm without inventing event details. |

## Manual launch checks

- Confirm production domain, HTTPS/CDN configuration, cache policy, backend API origin, and image/media delivery.
- Load-test the deployed frontend/API/database together and confirm the rate limiter and connection pool are safe for the expected traffic.
- Publish legally approved privacy, terms, cancellation/refund, artist, cookie, and accessibility policies; update footer destinations.
- Configure production analytics/consent behavior and verify error reporting.

## Homepage redesign verification (2026-11-16)

- Preserved the current logo, brand color palette, font pairing, and existing CMS/website copy. The section order and card layout now follow the supplied reference; event, artist, blog, and partner records remain API-driven.
- Captured fresh full-page homepage screenshots at mobile (375×812), tablet (768×1024), laptop (1366×768), and desktop (1920×1080). All four returned HTTP 200, had one H1, no horizontal overflow, no broken images, and no browser console/page errors during capture.
- Latest single Lighthouse mobile run on the local production preview: Performance **76**, Accessibility **100**, Best Practices **100**, SEO **100**. Baseline: **73 / 87 / 96 / 100**. LCP is **7.1 s** versus **5.1 s** baseline (still regressed); TBT is **90 ms** versus **360 ms**, CLS remains **0**. Performance has not reached the 90-point target and should be rechecked after image/CDN and CSS-bundling work.
- The final build succeeds, but Next.js 16.4.0 prints a known security-vulnerability upgrade warning. The full-site after-capture, complete performance remediation, and deployment/load validation are still outstanding.

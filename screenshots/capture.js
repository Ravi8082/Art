const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require('@playwright/test')

const root = path.resolve(__dirname, '..')
const appRoot = path.join(root, 'app')
const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
const phase = process.argv[2] || process.env.SCREENSHOT_PHASE || 'before'
const outputRoot = path.join(__dirname, phase)
const allDevices = [
  { name: 'mobile', viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
  { name: 'tablet', viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true },
  { name: 'laptop', viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false },
  { name: 'desktop', viewport: { width: 1920, height: 1080 }, isMobile: false, hasTouch: false },
]
const devices = process.env.CAPTURE_DEVICES
  ? allDevices.filter((device) => process.env.CAPTURE_DEVICES.split(',').includes(device.name))
  : allDevices
const dynamicValues = {
  id: 'capture-sample',
  slug: 'the-haat-of-art-mumbai-2026',
  token: 'capture-invalid-token',
  userId: 'capture-sample-user',
}

async function findPages(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const pages = []
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) pages.push(...await findPages(fullPath))
    else if (entry.isFile() && /^page\.(tsx|ts|jsx|js)$/.test(entry.name)) pages.push(fullPath)
  }
  return pages
}

function routeForPage(file) {
  const segments = path.relative(appRoot, path.dirname(file)).split(path.sep).filter(Boolean)
  const visibleSegments = segments.filter((segment) => !/^\(.+\)$/.test(segment))
  const resolvedSegments = visibleSegments.map((segment) => {
    const dynamic = segment.match(/^\[\[?\.\.\.?(.*?)\]\]?$/) || segment.match(/^\[(.+)\]$/)
    if (!dynamic) return segment
    const key = dynamic[1]
    return dynamicValues[key] || `capture-${key}`
  })
  return `/${resolvedSegments.join('/')}`
}

function screenshotName(route, device) {
  const routeName = route === '/' ? 'home' : route.slice(1).replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/g, '')
  return `${routeName || 'home'}-${device}.png`
}

async function readPageAudit(page) {
  return page.evaluate(() => {
    const rect = document.documentElement.getBoundingClientRect()
    const images = [...document.images]
    const missingAlt = images.filter((image) => !image.hasAttribute('alt')).map((image) => image.currentSrc || image.src)
    const brokenImages = images.filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.src)
    const anchors = [...document.querySelectorAll('a[href]')].map((anchor) => ({
      href: anchor.getAttribute('href'),
      text: (anchor.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
    }))
    const missingFragments = anchors
      .map(({ href }) => href)
      .filter((href) => href && href.startsWith('#') && href.length > 1)
      .filter((href) => !document.getElementById(decodeURIComponent(href.slice(1))))
    const h1Count = document.querySelectorAll('h1').length
    const smallTargets = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')]
      .map((element) => {
        const style = getComputedStyle(element)
        const labels = element.matches('input, select, textarea') ? [...(element.labels || [])] : []
        const wrappingLabel = element.closest('label')
        if (wrappingLabel && !labels.includes(wrappingLabel)) labels.push(wrappingLabel)
        const target = labels.reduce((largest, label) => {
          const box = label.getBoundingClientRect()
          const current = largest?.getBoundingClientRect()
          return !current || box.width * box.height > current.width * current.height ? label : largest
        }, null) || element
        const box = target.getBoundingClientRect()
        const targetStyle = getComputedStyle(target)
        const visible = style.display !== 'none' && style.visibility !== 'hidden'
          && targetStyle.display !== 'none' && targetStyle.visibility !== 'hidden'
        return { element, target, box, visible }
      })
      .filter(({ box, visible }) => visible && box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44))
      .map((element) => ({
        label: (element.element.getAttribute('aria-label') || element.element.textContent || element.element.getAttribute('placeholder') || '').trim().slice(0, 80),
        tag: element.element.tagName.toLowerCase(),
        type: element.element.getAttribute('type') || '',
        className: element.element.getAttribute('class') || '',
        width: Math.round(element.box.width),
        height: Math.round(element.box.height),
      }))
    return {
      title: document.title,
      lang: document.documentElement.lang,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
      openGraphTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '',
      openGraphImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '',
      h1Count,
      mainCount: document.querySelectorAll('main').length,
      missingAlt,
      brokenImages,
      smallTargets,
      missingFragments,
      anchors,
      horizontalOverflow: rect.width > window.innerWidth,
      documentWidth: Math.round(rect.width),
      viewportWidth: window.innerWidth,
    }
  })
}

async function checkInternalLinks(links, origin) {
  const urls = new Map()
  for (const { href, route } of links) {
    if (!href || href.startsWith('#')) continue
    let url
    try {
      url = new URL(href, origin)
    } catch {
      continue
    }
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) continue
    url.hash = ''
    urls.set(url.toString(), [...(urls.get(url.toString()) || []), route])
  }
  const entries = [...urls.entries()]
  const broken = []
  let next = 0
  const workers = Array.from({ length: Math.min(8, entries.length) }, async () => {
    while (next < entries.length) {
      const index = next++
      const [url, routes] = entries[index]
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(12000), redirect: 'follow' })
        if (response.status >= 400) broken.push({ url, status: response.status, routes })
        await response.body?.cancel()
      } catch (error) {
        broken.push({ url, error: error instanceof Error ? error.message : String(error), routes })
      }
    }
  })
  await Promise.all(workers)
  return broken
}

async function main() {
  await fs.mkdir(outputRoot, { recursive: true })
  const discoveredRoutes = [...new Set((await findPages(appRoot)).map(routeForPage))].sort()
  const requestedRoutes = process.env.CAPTURE_ROUTES?.split(',').map((route) => route.trim()).filter(Boolean)
  const routes = requestedRoutes || discoveredRoutes
  if (!routes.includes('/__capture_404__')) routes.push('/__capture_404__')
  const results = []
  const errors = []
  const linkRefs = []
  const origin = new URL(baseUrl).origin
  const browser = await chromium.launch({ headless: true })

  try {
    for (const device of devices) {
      const context = await browser.newContext({
        viewport: device.viewport,
        deviceScaleFactor: 1,
        isMobile: device.isMobile,
        hasTouch: device.hasTouch,
      })
      const page = await context.newPage()
      let activeRoute = ''
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push({ type: 'console', route: activeRoute, message: message.text() })
      })
      page.on('pageerror', (error) => errors.push({ type: 'pageerror', route: activeRoute, message: error.message }))
      page.on('requestfailed', (request) => errors.push({
        type: 'requestfailed',
        route: activeRoute,
        url: request.url(),
        message: request.failure()?.errorText || 'Request failed',
      }))
      page.on('response', (response) => {
        if (response.status() >= 400) errors.push({
          type: 'http',
          route: activeRoute,
          url: response.url(),
          status: response.status(),
        })
      })

      for (const route of routes) {
        activeRoute = route
        let responseStatus = null
        let navigationError = null
        try {
          const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
          responseStatus = response?.status() ?? null
          await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
          if (route === '/contact') {
            await page.waitForFunction(() => !document.querySelector('.cb-intro'), null, { timeout: 10000 })
          }
          await page.evaluate(async () => {
            await document.fonts?.ready
            for (const image of document.images) image.loading = 'eager'
          })
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
          const audit = await readPageAudit(page)
          linkRefs.push(...audit.anchors.map(({ href }) => ({ href, route })))
          results.push({ route, device: device.name, responseStatus, ...audit })
          await page.screenshot({
            path: path.join(outputRoot, screenshotName(route, device.name)),
            fullPage: true,
            animations: 'disabled',
            timeout: 60000,
          })
        } catch (error) {
          navigationError = error instanceof Error ? error.message : String(error)
          errors.push({ type: 'capture', route, device: device.name, message: navigationError })
          results.push({ route, device: device.name, responseStatus, navigationError })
        }
      }
      await context.close()
      console.log(`Captured ${routes.length} routes at ${device.name} (${device.viewport.width}x${device.viewport.height}).`)
    }
  } finally {
    await browser.close()
  }

  const brokenLinks = await checkInternalLinks(linkRefs, origin)
  const log = {
    phase,
    baseUrl,
    createdAt: new Date().toISOString(),
    routeCount: routes.length,
    viewportCount: devices.length,
    screenshotCount: results.filter((result) => !result.navigationError).length,
    routes,
    results,
    consoleAndNetworkErrors: errors,
    brokenInternalLinks: brokenLinks,
  }
  await fs.writeFile(path.join(outputRoot, 'audit-log.json'), JSON.stringify(log, null, 2))
  console.log(`Saved ${log.screenshotCount} screenshots and audit log to ${outputRoot}`)
  console.log(`Found ${errors.length} console/network/HTTP errors and ${brokenLinks.length} broken internal links.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

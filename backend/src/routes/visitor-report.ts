import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'

export const visitorReportRouter = Router()
const guard = [requireAuth, requirePermission('users:manage')] as const

// Registration state wins; otherwise fall back to the event's state when it is a single state.
const stateExpr = `COALESCE(NULLIF(r.visitor_state,''), IF(e.state NOT LIKE '%,%' AND e.state NOT LIKE 'Multiple%' AND e.state NOT LIKE 'Pan India%', e.state, NULL), 'Not specified')`
const cityExpr = `COALESCE(NULLIF(r.visitor_city,''), NULLIF(v.city,''), 'Not specified')`

const filterSchema = z.object({
  state: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  eventId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

type Row = {
  state: string; city: string; fullName: string; email: string; phone: string | null; attendingAs: string | null
  eventTitle: string; registeredAt: Date; checkedInAt: Date | null
}

async function loadReport(query: unknown) {
  const filters = filterSchema.parse(query)
  const where = ["r.status='REGISTERED'"]
  const params: unknown[] = []
  if (filters.eventId) { where.push('e.id=?'); params.push(filters.eventId) }
  if (filters.from) { where.push('r.created_at>=?'); params.push(`${filters.from} 00:00:00`) }
  if (filters.to) { where.push('r.created_at<?'); params.push(`${filters.to} 23:59:59.999`) }
  const [all] = await pool.query<any[]>(`SELECT ${stateExpr} state,${cityExpr} city,v.full_name fullName,v.email,v.phone,
      v.attending_as attendingAs,e.title eventTitle,r.created_at registeredAt,MIN(c.checked_in_at) checkedInAt
    FROM event_registrations r JOIN visitor_profiles v ON v.id=r.visitor_id JOIN events e ON e.id=r.event_id
    LEFT JOIN qr_passes q ON q.registration_id=r.id AND q.revoked_at IS NULL
    LEFT JOIN check_ins c ON c.pass_id=q.id
    WHERE ${where.join(' AND ')}
    GROUP BY r.id,v.id,e.id
    ORDER BY state,city,r.created_at DESC`, params) as [Row[], unknown]

  const stateCity = new Map<string, Map<string, { registered: number; checkedIn: number }>>()
  for (const row of all) {
    const cities = stateCity.get(row.state) ?? new Map()
    const entry = cities.get(row.city) ?? { registered: 0, checkedIn: 0 }
    entry.registered += 1
    if (row.checkedInAt) entry.checkedIn += 1
    cities.set(row.city, entry)
    stateCity.set(row.state, cities)
  }
  const states = [...stateCity.entries()].map(([state, cities]) => {
    const cityRows = [...cities.entries()].map(([city, c]) => ({ city, ...c })).sort((a, b) => b.registered - a.registered)
    return {
      state,
      registered: cityRows.reduce((n, c) => n + c.registered, 0),
      checkedIn: cityRows.reduce((n, c) => n + c.checkedIn, 0),
      cities: cityRows,
    }
  }).sort((a, b) => b.registered - a.registered)

  const visitors = all.filter((row) => (!filters.state || row.state.toLowerCase() === filters.state.toLowerCase())
    && (!filters.city || row.city.toLowerCase() === filters.city.toLowerCase()))
  const [events] = await pool.query<any[]>('SELECT id,title FROM events ORDER BY starts_at DESC LIMIT 200')
  return {
    filters,
    events,
    states,
    visitors,
    totals: {
      registered: visitors.length,
      checkedIn: visitors.filter((row) => row.checkedInAt).length,
      states: new Set(visitors.map((row) => row.state)).size,
      cities: new Set(visitors.map((row) => `${row.state}|${row.city}`)).size,
    },
  }
}

const fmt = (value: Date | null) => value ? new Date(value).toISOString().slice(0, 16).replace('T', ' ') : ''
const scopeLabel = (f: z.infer<typeof filterSchema>) => [f.state, f.city].filter(Boolean).join(' / ') || 'All states'

visitorReportRouter.get('/', ...guard, async (req, res, next) => {
  try {
    const report = await loadReport(req.query)
    res.json({ ...report, visitors: report.visitors.slice(0, 500) })
  } catch (error) { next(error) }
})

visitorReportRouter.get('/export', ...guard, async (req, res, next) => {
  try {
    const format = z.enum(['xlsx', 'pdf']).parse(req.query.format)
    const report = await loadReport(req.query)
    const stamp = new Date().toISOString().slice(0, 10)
    const scoped = report.visitors
    const stateRows = report.states.filter((s) => !report.filters.state || s.state.toLowerCase() === report.filters.state.toLowerCase())

    if (format === 'xlsx') {
      const book = new ExcelJS.Workbook()
      const head = (sheet: ExcelJS.Worksheet) => {
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1E36' } }
        sheet.views = [{ state: 'frozen', ySplit: 1 }]
      }
      const byState = book.addWorksheet('By state')
      byState.columns = [{ header: 'State', key: 'state', width: 28 }, { header: 'Registered', key: 'registered', width: 14 }, { header: 'Checked in', key: 'checkedIn', width: 14 }]
      stateRows.forEach((s) => byState.addRow(s))
      byState.addRow({ state: 'Total', registered: stateRows.reduce((n, s) => n + s.registered, 0), checkedIn: stateRows.reduce((n, s) => n + s.checkedIn, 0) }).font = { bold: true }
      head(byState)

      const byCity = book.addWorksheet('By city')
      byCity.columns = [{ header: 'State', key: 'state', width: 28 }, { header: 'City', key: 'city', width: 28 }, { header: 'Registered', key: 'registered', width: 14 }, { header: 'Checked in', key: 'checkedIn', width: 14 }]
      stateRows.forEach((s) => s.cities.forEach((c) => byCity.addRow({ state: s.state, ...c })))
      head(byCity)

      const list = book.addWorksheet('Visitors')
      list.columns = [
        { header: 'Name', key: 'fullName', width: 28 }, { header: 'Email', key: 'email', width: 32 }, { header: 'Phone', key: 'phone', width: 16 },
        { header: 'State', key: 'state', width: 22 }, { header: 'City', key: 'city', width: 22 }, { header: 'Attending as', key: 'attendingAs', width: 26 },
        { header: 'Exhibition', key: 'eventTitle', width: 40 }, { header: 'Registered at', key: 'registeredAt', width: 18 }, { header: 'Checked in', key: 'checkedInAt', width: 18 },
      ]
      scoped.forEach((v) => list.addRow({ ...v, phone: v.phone ?? '', attendingAs: v.attendingAs ?? '', registeredAt: fmt(v.registeredAt), checkedInAt: fmt(v.checkedInAt) }))
      head(list)

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="visitors-${stamp}.xlsx"`)
      await book.xlsx.write(res)
      return res.end()
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="visitors-${stamp}.pdf"`)
    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    doc.pipe(res)
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f1e36').text('The Haat of Art — Visitor report')
    doc.font('Helvetica').fontSize(10).fillColor('#555').text(`${scopeLabel(report.filters)} · generated ${stamp}`)
    doc.moveDown(0.6).fillColor('#000').fontSize(11)
      .text(`Registered: ${report.totals.registered}   Checked in: ${report.totals.checkedIn}   States: ${report.totals.states}   Cities: ${report.totals.cities}`)
    const ensure = (height: number) => { if (doc.y + height > doc.page.height - 50) doc.addPage() }
    const line = (cols: [string, number][], bold = false) => {
      ensure(16)
      const y = doc.y
      let x = 40
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
      for (const [text, width] of cols) { doc.text(text, x, y, { width: width - 6, height: 12, ellipsis: true, lineBreak: false }); x += width }
      doc.y = y + 15
      doc.x = 40
    }
    doc.moveDown(0.8).font('Helvetica-Bold').fontSize(13).fillColor('#ee4b12').text('Visitors by state and city').fillColor('#000')
    doc.moveDown(0.3)
    line([['State / City', 260], ['Registered', 90], ['Checked in', 90]], true)
    for (const s of stateRows) {
      line([[s.state, 260], [String(s.registered), 90], [String(s.checkedIn), 90]], true)
      for (const c of s.cities) line([[`    ${c.city}`, 260], [String(c.registered), 90], [String(c.checkedIn), 90]])
    }
    doc.addPage().font('Helvetica-Bold').fontSize(13).fillColor('#ee4b12').text('Visitor list').fillColor('#000')
    doc.moveDown(0.3)
    const cols = (v: { a: string; b: string; c: string; d: string; e: string }): [string, number][] => [[v.a, 110], [v.b, 150], [v.c, 90], [v.d, 90], [v.e, 75]]
    line(cols({ a: 'Name', b: 'Email', c: 'State', d: 'City', e: 'Checked in' }), true)
    scoped.slice(0, 2000).forEach((v) => line(cols({ a: v.fullName, b: v.email, c: v.state, d: v.city, e: v.checkedInAt ? 'Yes' : 'No' })))
    if (scoped.length > 2000) doc.text(`…and ${scoped.length - 2000} more (download Excel for the full list).`)
    doc.end()
  } catch (error) { next(error) }
})

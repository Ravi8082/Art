'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import Link from 'next/link'
import type { EventFlowContent, EventFlowPhase } from '@/lib/api'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const phaseIds: EventFlowPhase['id'][] = ['pre-event', 'inauguration', 'showcase', 'felicitation', 'closing']

async function readError(response: Response) {
  const data: unknown = await response.json().catch(() => null)
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error
  return `Request failed (${response.status})`
}

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...init })
  if (!response.ok) throw new Error(await readError(response))
  return response
}

function mediaUrl(url: string) {
  return url.startsWith('/api/') ? `${apiBaseUrl}${url}` : url
}

export function EventFlowManager() {
  const [content, setContent] = useState<EventFlowContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhase, setUploadingPhase] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const response = await api('/api/admin/event-flow', { cache: 'no-store' })
    const data = await response.json() as EventFlowContent
    setContent(data)
  }, [])

  useEffect(() => {
    let active = true
    void load()
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Event flow content could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load])

  function updatePhase(index: number, patch: Partial<EventFlowPhase>) {
    setContent((current) => current && ({
      ...current,
      phases: current.phases.map((phase, phaseIndex) => phaseIndex === index ? { ...phase, ...patch } : phase),
    }))
  }

  function updateScheduleDay(dayIndex: number, patch: Partial<EventFlowContent['schedule'][number]>) {
    setContent((current) => current && ({
      ...current,
      schedule: current.schedule.map((day, index) => index === dayIndex ? { ...day, ...patch } : day),
    }))
  }

  function updateScheduleItem(dayIndex: number, itemIndex: number, patch: Partial<EventFlowContent['schedule'][number]['items'][number]>) {
    setContent((current) => current && ({
      ...current,
      schedule: current.schedule.map((day, index) => index === dayIndex
        ? { ...day, items: day.items.map((item, currentIndex) => currentIndex === itemIndex ? { ...item, ...patch } : item) }
        : day),
    }))
  }

  async function uploadPhoto(phase: EventFlowPhase, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file for the phase photo.')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('Phase photos must be 25 MB or smaller.')
      return
    }
    setUploadingPhase(phase.id)
    setError('')
    setMessage('')
    try {
      const response = await api(`/api/admin/event-flow/phases/${phase.id}/photo`, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'X-Alt-Text': encodeURIComponent(`${phase.title} at The Haat of Art`) },
        body: file,
      })
      const result = await response.json() as { imageUrl: string }
      const index = phaseIds.indexOf(phase.id)
      updatePhase(index, { imageUrl: result.imageUrl })
      setMessage(`Photo updated for ${phase.title}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The phase photo could not be uploaded.')
    } finally {
      setUploadingPhase(null)
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!content) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await api('/api/admin/event-flow', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      })
      setMessage('Event flow content saved.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Event flow content could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="event-admin event-flow-manager">
      <header className="event-admin-header">
        <div>
          <p className="eyebrow">The Haat of Art · Editorial CMS</p>
          <h1>Event Flow &amp; Exhibition Schedule</h1>
          <p>Edit the public journey, phase photography and typical three-day timetable.</p>
        </div>
        <Link className="event-admin-back" href="/dashboard">Dashboard</Link>
      </header>
      {message && <p className="event-flow-admin-notice" role="status">{message}</p>}
      {error && <p className="event-flow-admin-error" role="alert">{error}</p>}
      {loading ? <p>Loading event flow content…</p> : !content ? (
        <p className="event-flow-admin-error" role="alert">Event flow content is unavailable. Check the database migration and try again.</p>
      ) : (
        <form className="event-flow-admin-form" onSubmit={save}>
          <section className="event-flow-admin-panel">
            <header><p className="eyebrow">EDITORIAL HERO &amp; CLOSING CTA</p><h2>Page introduction</h2></header>
            <label>Kicker<input value={content.kicker} maxLength={180} required onChange={(event) => setContent({ ...content, kicker: event.target.value })} /></label>
            <label>Page title<input value={content.title} maxLength={240} required onChange={(event) => setContent({ ...content, title: event.target.value })} /></label>
            <label>Subheadline<textarea rows={3} value={content.subtitle} maxLength={2000} required onChange={(event) => setContent({ ...content, subtitle: event.target.value })} /></label>
            <label>Bottom CTA title<input value={content.ctaTitle} maxLength={240} required onChange={(event) => setContent({ ...content, ctaTitle: event.target.value })} /></label>
          </section>

          <section className="event-flow-admin-panel">
            <header><p className="eyebrow">CHRONOLOGICAL PHASES</p><h2>Five exhibition stages</h2></header>
            <div className="event-flow-admin-phases">
              {content.phases.map((phase, index) => (
                <article className="event-flow-admin-phase" key={phase.id}>
                  <div className="event-flow-admin-phase-heading"><strong>{phase.number}</strong><h3>{phase.title}</h3></div>
                  <div className="event-flow-admin-phase-grid">
                    <label>Phase title<input value={phase.title} maxLength={180} required onChange={(event) => updatePhase(index, { title: event.target.value })} /></label>
                    <label>Time window<input value={phase.timeframe} maxLength={140} required onChange={(event) => updatePhase(index, { timeframe: event.target.value })} /></label>
                    <label>Audience tags <small>Separate tags with commas</small>
                      <input value={phase.audience.join(', ')} required onChange={(event) => updatePhase(index, { audience: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} />
                    </label>
                    <label>Introduction<textarea rows={3} maxLength={1000} value={phase.introduction} required onChange={(event) => updatePhase(index, { introduction: event.target.value })} /></label>
                    <label className="event-flow-admin-activities">Activities <small>One item per line</small>
                      <textarea rows={5} value={phase.activities.join('\n')} required onChange={(event) => updatePhase(index, { activities: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} />
                    </label>
                  </div>
                  <div className="event-flow-admin-photo">
                    <img src={mediaUrl(phase.imageUrl)} alt={`${phase.title} preview`} />
                    <label className="event-flow-upload-button">
                      {uploadingPhase === phase.id ? 'Uploading…' : 'Upload phase photo'}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploadingPhase !== null} onChange={(event) => { void uploadPhoto(phase, event) }} />
                    </label>
                    <small>Portrait or landscape · JPG, PNG, WebP or GIF · up to 25 MB</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="event-flow-admin-panel">
            <header><p className="eyebrow">THREE-DAY EDITION</p><h2>Timetable matrix</h2></header>
            <div className="event-flow-admin-schedule">
              {content.schedule.map((day, dayIndex) => (
                <article className="event-flow-admin-day" key={day.day}>
                  <label>Day label<input value={day.day} maxLength={40} required onChange={(event) => updateScheduleDay(dayIndex, { day: event.target.value })} /></label>
                  <label>Day theme<input value={day.title} maxLength={120} required onChange={(event) => updateScheduleDay(dayIndex, { title: event.target.value })} /></label>
                  {day.items.map((item, itemIndex) => (
                    <div className="event-flow-admin-timetable-row" key={`${dayIndex}-${itemIndex}`}>
                      <label>Session
                        <select value={item.period} onChange={(event) => {
                          const period = event.target.value
                          if (period === 'Morning' || period === 'Afternoon' || period === 'Evening') {
                            updateScheduleItem(dayIndex, itemIndex, { period })
                          }
                        }}>
                          <option>Morning</option><option>Afternoon</option><option>Evening</option>
                        </select>
                      </label>
                      <label>Time<input value={item.time} maxLength={80} required onChange={(event) => updateScheduleItem(dayIndex, itemIndex, { time: event.target.value })} /></label>
                      <label>Activity<input value={item.activity} maxLength={300} required onChange={(event) => updateScheduleItem(dayIndex, itemIndex, { activity: event.target.value })} /></label>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          </section>
          <div className="event-flow-admin-submit">
            <button type="submit" disabled={saving || uploadingPhase !== null}>{saving ? 'Saving…' : 'Save Event Flow Page'}</button>
            <span>Text and schedule changes publish to the public page after saving.</span>
          </div>
        </form>
      )}
    </main>
  )
}

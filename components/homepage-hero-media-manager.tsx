'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ImagePlus, Trash2, Upload } from 'lucide-react'
import type { HomepageHeroMedia } from '@/lib/homepage-content'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const imageTypes = 'image/jpeg,image/png,image/webp'
const videoTypes = 'video/mp4,video/webm'

async function responseError(response: Response) {
  const result: unknown = await response.json().catch(() => null)
  if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') return result.error
  return `Request failed (${response.status})`
}

function isNetworkFailure(cause: unknown) {
  return cause instanceof Error && /failed to fetch|fetch failed|network error|network request failed|load failed/i.test(cause.message)
}

function mediaUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `${apiBaseUrl}${url}`
}

export function HomepageHeroMediaManager({
  media,
  onChange,
  onUploadingChange,
  disabled = false,
}: {
  media: HomepageHeroMedia
  onChange: (media: HomepageHeroMedia) => void
  onUploadingChange: (uploading: boolean) => void
  disabled?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const retryUpload = useRef<(() => void) | null>(null)
  const uploadedSlides = useRef(new Map<File, HomepageHeroMedia['slides'][number]>())

  function reportUploadError(cause: unknown, fallback: string, retry: () => void) {
    const networkFailure = isNetworkFailure(cause)
    setUploadError(networkFailure
      ? 'Network/server se upload nahi ho paya — kripya dobara koshish karein. / Upload failed — please try again.'
      : cause instanceof Error ? cause.message : fallback)
    retryUpload.current = networkFailure ? retry : null
  }

  async function upload(file: File) {
    const body = new FormData()
    body.append('file', file)
    const response = await fetch(`${apiBaseUrl}/api/dashboard/homepage/upload`, {
      method: 'POST',
      credentials: 'include',
      body,
    })
    if (!response.ok) throw new Error(await responseError(response))
    return await response.json() as { url: string; mimeType: string; size: number }
  }

  async function uploadSlideFiles(files: File[]) {
    setUploadError('')
    retryUpload.current = null
    if (!files.length) return
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setUploadError('Choose JPEG, PNG, or WebP images.')
      return
    }
    if (media.slides.length + files.length > 30) {
      setUploadError('You can choose up to 30 homepage photos.')
      return
    }

    setUploading(true)
    onUploadingChange(true)
    try {
      for (const file of files) {
        if (uploadedSlides.current.has(file)) continue
        const uploaded = await upload(file)
        uploadedSlides.current.set(file, {
          id: crypto.randomUUID(),
          imageUrl: uploaded.url,
          altText: '',
          caption: '',
          sortOrder: media.slides.length + uploadedSlides.current.size - 1,
          isActive: true,
        })
      }
      onChange({
        ...media,
        slidesManaged: true,
        slides: [...media.slides, ...files.map((file) => uploadedSlides.current.get(file)).filter((slide): slide is HomepageHeroMedia['slides'][number] => Boolean(slide))],
      })
      uploadedSlides.current.clear()
    } catch (cause) {
      reportUploadError(cause, 'Hero photos could not be uploaded.', () => { void uploadSlideFiles(files) })
    } finally {
      setUploading(false)
      onUploadingChange(false)
    }
  }

  function uploadSlides(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    void uploadSlideFiles(files)
  }

  async function uploadVideo(file: File, kind: 'video' | 'poster') {
    setUploadError('')
    retryUpload.current = null
    const allowed = kind === 'video' ? ['video/mp4', 'video/webm'] : ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setUploadError(kind === 'video' ? 'Choose an MP4 or WebM video.' : 'Choose a JPEG, PNG, or WebP poster image.')
      return
    }
    setUploading(true)
    onUploadingChange(true)
    try {
      const uploaded = await upload(file)
      onChange({
        ...media,
        video: { ...media.video, [kind === 'video' ? 'url' : 'posterUrl']: uploaded.url },
      })
    } catch (cause) {
      reportUploadError(cause, 'The media file could not be uploaded.', () => { void uploadVideo(file, kind) })
    } finally {
      setUploading(false)
      onUploadingChange(false)
    }
  }

  function updateSlide(index: number, patch: Partial<HomepageHeroMedia['slides'][number]>) {
    onChange({
      ...media,
      slides: media.slides.map((slide, slideIndex) => slideIndex === index ? { ...slide, ...patch } : slide),
    })
  }

  function moveSlide(index: number, direction: -1 | 1) {
    const destination = index + direction
    if (destination < 0 || destination >= media.slides.length) return
    const slides = [...media.slides]
    ;[slides[index], slides[destination]] = [slides[destination], slides[index]]
    onChange({ ...media, slides: slides.map((slide, sortOrder) => ({ ...slide, sortOrder })) })
  }

  function updateVideo(patch: Partial<HomepageHeroMedia['video']>) {
    onChange({ ...media, video: { ...media.video, ...patch } })
  }

  return (
    <div className="homepage-hero-media-editor">
      <div className="homepage-hero-step">1. Photo ya Video chunein</div>
      <div className="homepage-hero-media-heading">
        <div>
          <h3>Homepage photos</h3>
          <p>Choose one or more photos, then set the order and words shown with them.</p>
        </div>
        <label className="homepage-upload-button">
          <ImagePlus size={15} />{uploading ? 'Uploading…' : 'Choose photos'}
          <input type="file" accept={imageTypes} multiple disabled={disabled || uploading} onChange={uploadSlides} />
        </label>
      </div>

      <div className="homepage-hero-ready-status" aria-live="polite">
        {(media.slides.length > 0 || media.video.posterUrl.trim()) && <span className="is-ready"><ImagePlus size={14} />Photo ready</span>}
        {media.video.url.trim() && <span className="is-ready"><Upload size={14} />Video ready</span>}
        {uploading && <span className="is-uploading">Uploading…</span>}
      </div>

      {media.slides.length ? (
        <div className="homepage-hero-slide-list">
          {media.slides.map((slide, index) => (
            <article className={`homepage-hero-slide${slide.isActive ? '' : ' is-inactive'}`} key={slide.id}>
              <img src={mediaUrl(slide.imageUrl)} alt={slide.altText || `Hero slide ${index + 1} preview`} />
              <div className="homepage-hero-slide-fields">
                <strong>Photo {index + 1}</strong>
                <label>Describe the photo<input maxLength={255} value={slide.altText} disabled={disabled || uploading} onChange={(event) => updateSlide(index, { altText: event.target.value })} /></label>
                <label>Words shown with photo<input maxLength={500} value={slide.caption} disabled={disabled || uploading} onChange={(event) => updateSlide(index, { caption: event.target.value })} /></label>
              </div>
              <div className="homepage-hero-slide-actions">
                <label className="homepage-toggle" title="Show or hide this photo on the homepage"><input type="checkbox" checked={slide.isActive} disabled={disabled || uploading} onChange={(event) => updateSlide(index, { isActive: event.target.checked })} /> Show photo</label>
                <button type="button" aria-label={`Move photo ${index + 1} up`} title="Move photo up" disabled={disabled || uploading || index === 0} onClick={() => moveSlide(index, -1)}><ArrowUp size={14} /><span>Up</span></button>
                <button type="button" aria-label={`Move photo ${index + 1} down`} title="Move photo down" disabled={disabled || uploading || index === media.slides.length - 1} onClick={() => moveSlide(index, 1)}><ArrowDown size={14} /><span>Down</span></button>
                <button type="button" className="is-danger" aria-label={`Delete photo ${index + 1}`} title="Delete photo" disabled={disabled || uploading} onClick={() => onChange({
                  ...media,
                  slides: media.slides.filter((_, slideIndex) => slideIndex !== index).map((item, sortOrder) => ({ ...item, sortOrder })),
                })}><Trash2 size={14} /><span>Delete</span></button>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="homepage-hero-empty">No homepage photos yet. Choose a photo to get started.</p>}

      <div className="homepage-hero-video">
        <div className="homepage-hero-media-heading">
          <div>
            <h3>Hero video</h3>
            <p>Choose a video file or paste its web address below.</p>
          </div>
          <label className="homepage-upload-button">
            <Upload size={15} />Choose video
            <input type="file" accept={videoTypes} disabled={disabled || uploading} onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) void uploadVideo(file, 'video')
            }} />
          </label>
        </div>
        <label>Video web address (optional)<input type="url" maxLength={1000} value={media.video.url.startsWith('/api/homepage/') ? '' : media.video.url} placeholder="https://example.com/hero-video.mp4" disabled={disabled || uploading} onChange={(event) => updateVideo({ url: event.target.value })} /></label>
        {media.video.url.startsWith('/api/homepage/') && <p className="homepage-uploaded-path">Uploaded video: {media.video.url}</p>}
        <div className="homepage-hero-video-poster">
          <label>Video cover photo web address<input type="url" maxLength={1000} value={media.video.posterUrl.startsWith('/api/homepage/') ? '' : media.video.posterUrl} placeholder="https://example.com/video-cover.jpg" disabled={disabled || uploading} onChange={(event) => updateVideo({ posterUrl: event.target.value })} /></label>
          <label className="homepage-upload-button">
            <ImagePlus size={15} />Choose cover photo
            <input type="file" accept={imageTypes} disabled={disabled || uploading} onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) void uploadVideo(file, 'poster')
            }} />
          </label>
        </div>
        {media.video.posterUrl.startsWith('/api/homepage/') && <p className="homepage-uploaded-path">Uploaded poster: {media.video.posterUrl}</p>}
        <div className="homepage-hero-video-options">
          <label className="homepage-toggle"><input type="checkbox" checked={media.video.enabled} disabled={disabled || uploading} onChange={(event) => updateVideo({ enabled: event.target.checked })} /> Show video on homepage</label>
          <label className="homepage-toggle"><input type="checkbox" checked={media.video.autoplay} disabled={disabled || uploading} onChange={(event) => updateVideo({ autoplay: event.target.checked })} /> Start muted</label>
          <label className="homepage-toggle"><input type="checkbox" checked={media.video.loop} disabled={disabled || uploading} onChange={(event) => updateVideo({ loop: event.target.checked })} /> Repeat video</label>
        </div>
      </div>

      {uploadError && <div className="homepage-hero-upload-error" role="alert">
        <span>{uploadError}</span>
        {retryUpload.current && <button type="button" onClick={() => {
          const retry = retryUpload.current
          retryUpload.current = null
          setUploadError('')
          retry?.()
        }}>Retry</button>}
      </div>}
      <Link className="site-content-link" href="/dashboard/homepage-media">Open earlier photo manager <Upload size={14} /></Link>
    </div>
  )
}

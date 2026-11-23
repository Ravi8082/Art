import { apiBaseUrl } from './api'

export type GalleryConfig = { showCuratedArtworks: boolean }

export const defaultGalleryConfig: GalleryConfig = { showCuratedArtworks: false }

export async function getGalleryConfig(): Promise<GalleryConfig> {
  const response = await fetch(`${apiBaseUrl}/api/site-settings/gallery`, { cache: 'no-store' })
  if (!response.ok) {
    if (response.status === 404) return defaultGalleryConfig
    throw new Error(`Gallery configuration could not be loaded (${response.status}).`)
  }
  const payload: unknown = await response.json()
  if (
    payload
    && typeof payload === 'object'
    && 'config' in payload
    && payload.config
    && typeof payload.config === 'object'
    && 'showCuratedArtworks' in payload.config
    && typeof payload.config.showCuratedArtworks === 'boolean'
  ) return { showCuratedArtworks: payload.config.showCuratedArtworks }
  throw new Error('Gallery configuration returned an invalid response.')
}

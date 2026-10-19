'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { defaultSiteSettings, type SiteSettings } from '@/lib/site-settings'

const SiteSettingsContext = createContext<SiteSettings>(defaultSiteSettings)

export function SiteSettingsProvider({ value, children }: { value: SiteSettings; children: ReactNode }) {
  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>
}

export const useSiteSettings = () => useContext(SiteSettingsContext)

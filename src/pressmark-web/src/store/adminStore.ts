import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

/**
 * Site settings as the admin screen last loaded or saved them. The SMTP password is
 * deliberately absent: it is write-only, never echoed back by the server, and what
 * the admin types into the form must not linger in global state (or in devtools).
 */
export interface AdminSiteSettings {
  siteName: string
  siteDescription: string
  communityWindowDays: number
  registrationMode: 'open' | 'invite_only'
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpUseTls: boolean
  smtpFromAddress: string
  commentsEnabled: boolean
  feedRetentionDays: number
  communityPageEnabled: boolean
}

interface AdminState {
  settings: AdminSiteSettings | null
  setSettings: (settings: AdminSiteSettings) => void
  reset: () => void
}

/**
 * Admin state shared across sections: the site settings, which the settings form
 * edits and the invites section reads (to know whether SMTP is configured). The
 * list sections keep their rows locally through useAdminPaginatedList.
 */
export const useAdminStore = create<AdminState>()(
  devtools(
    (set) => ({
      settings: null,
      setSettings: (settings) => set({ settings }),
      reset: () => set({ settings: null }),
    }),
    { name: 'admin' },
  ),
)

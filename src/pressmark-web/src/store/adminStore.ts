import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface SiteSettings {
  siteName: string
  communityWindowDays: number
  registrationMode: 'open' | 'invite_only'
}

interface UserInfo {
  id: string
  email: string
  role: string
  createdAt: string
}

interface AdminState {
  settings: SiteSettings | null
  users: UserInfo[]
  isLoading: boolean
  setSettings: (settings: SiteSettings) => void
  setUsers: (users: UserInfo[]) => void
  setLoading: (loading: boolean) => void
}

export const useAdminStore = create<AdminState>()(
  devtools(
    (set) => ({
      settings: null,
      users: [],
      isLoading: false,
      setSettings: (settings) => set({ settings }),
      setUsers: (users) => set({ users }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    { name: 'admin' }
  )
)

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface SiteSettings {
  siteName: string
  communityWindowDays: number
  registrationMode: 'open' | 'invite_only'
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassword: string
  smtpUseTls: boolean
  smtpFromAddress: string
}

interface UserInfo {
  id: string
  email: string
  role: string
  createdAt: string
}

export interface InviteItem {
  id: string
  token: string // populated only on creation
  note: string
  createdAt: string
  isUsed: boolean
  usedAt: string
  isRevoked: boolean
}

interface AdminState {
  settings: SiteSettings | null
  users: UserInfo[]
  invites: InviteItem[]
  isLoading: boolean
  setSettings: (settings: SiteSettings) => void
  setUsers: (users: UserInfo[]) => void
  setInvites: (invites: InviteItem[]) => void
  addInvite: (invite: InviteItem) => void
  removeInvite: (id: string) => void
  setLoading: (loading: boolean) => void
}

export const useAdminStore = create<AdminState>()(
  devtools(
    (set) => ({
      settings: null,
      users: [],
      invites: [],
      isLoading: false,
      setSettings: (settings) => set({ settings }),
      setUsers: (users) => set({ users }),
      setInvites: (invites) => set({ invites }),
      addInvite: (invite) => set((s) => ({ invites: [invite, ...s.invites] })),
      removeInvite: (id) =>
        set((s) => ({
          invites: s.invites.map((i) => (i.id === id ? { ...i, isRevoked: true } : i)),
        })),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    { name: 'admin' },
  ),
)

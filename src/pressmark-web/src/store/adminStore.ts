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
  commentsEnabled: boolean
}

interface UserInfo {
  id: string
  email: string
  role: string
  createdAt: string
  isCommentingBanned: boolean
}

export interface BannedSubscriptionItem {
  id: string
  rssUrl: string
  title: string
}

export interface InviteItem {
  id: string
  token: string // populated only on creation
  note: string
  createdAt: string
  expiresAt: string // empty = no expiry
}

interface AdminState {
  settings: SiteSettings | null
  users: UserInfo[]
  invites: InviteItem[]
  bannedSubscriptions: BannedSubscriptionItem[]
  isLoading: boolean
  setSettings: (settings: SiteSettings) => void
  setUsers: (users: UserInfo[]) => void
  setInvites: (invites: InviteItem[]) => void
  addInvite: (invite: InviteItem) => void
  removeInvite: (id: string) => void
  setBannedSubscriptions: (items: BannedSubscriptionItem[]) => void
  unbanSubscription: (id: string) => void
  updateUserCommentBan: (userId: string, banned: boolean) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useAdminStore = create<AdminState>()(
  devtools(
    (set) => ({
      settings: null,
      users: [],
      invites: [],
      bannedSubscriptions: [],
      isLoading: false,
      setSettings: (settings) => set({ settings }),
      setUsers: (users) => set({ users }),
      setInvites: (invites) => set({ invites }),
      addInvite: (invite) => set((s) => ({ invites: [invite, ...s.invites] })),
      removeInvite: (id) => set((s) => ({ invites: s.invites.filter((i) => i.id !== id) })),
      setBannedSubscriptions: (bannedSubscriptions) => set({ bannedSubscriptions }),
      unbanSubscription: (id) =>
        set((s) => ({ bannedSubscriptions: s.bannedSubscriptions.filter((b) => b.id !== id) })),
      updateUserCommentBan: (userId, banned) =>
        set((s) => ({
          users: s.users.map((u) => (u.id === userId ? { ...u, isCommentingBanned: banned } : u)),
        })),
      setLoading: (isLoading) => set({ isLoading }),
      reset: () =>
        set({ settings: null, users: [], invites: [], bannedSubscriptions: [], isLoading: false }),
    }),
    { name: 'admin' },
  ),
)

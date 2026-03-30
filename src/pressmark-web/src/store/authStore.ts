import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { useFeedStore } from './feedStore'
import { useSubscriptionStore } from './subscriptionStore'
import { useAdminStore } from './adminStore'

interface AuthUser {
  id: string
  email: string
  role: 'User' | 'Admin'
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  isInitialized: boolean
  registrationMode: 'open' | 'invite_only'
  communityWindowDays: number
  commentsEnabled: boolean
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
  setInitialized: () => void
  setRegistrationMode: (mode: 'open' | 'invite_only') => void
  setCommunityWindowDays: (days: number) => void
  setCommentsEnabled: (enabled: boolean) => void
  isAuthenticated: () => boolean
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      accessToken: null,
      user: null,
      isInitialized: false,
      registrationMode: 'open',
      communityWindowDays: 1,
      commentsEnabled: true,
      setAuth: (token, user) => set({ accessToken: token, user }),
      clearAuth: () => {
        set({ accessToken: null, user: null })
        useFeedStore.getState().reset()
        useSubscriptionStore.getState().reset()
        useAdminStore.getState().reset()
      },
      setInitialized: () => set({ isInitialized: true }),
      setRegistrationMode: (mode) => set({ registrationMode: mode }),
      setCommunityWindowDays: (days) => set({ communityWindowDays: days }),
      setCommentsEnabled: (enabled) => set({ commentsEnabled: enabled }),
      isAuthenticated: () => !!get().accessToken,
      isAdmin: () => get().user?.role === 'Admin',
    }),
    { name: 'auth' },
  ),
)

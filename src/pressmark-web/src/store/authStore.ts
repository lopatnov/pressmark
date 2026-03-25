import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface AuthUser {
  id: string
  email: string
  role: 'User' | 'Admin'
}

interface AuthState {
  accessToken: string | null
  user: AuthUser | null
  isInitialized: boolean
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
  setInitialized: () => void
  isAuthenticated: () => boolean
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      accessToken: null,
      user: null,
      isInitialized: false,
      setAuth: (token, user) => set({ accessToken: token, user }),
      clearAuth: () => set({ accessToken: null, user: null }),
      setInitialized: () => set({ isInitialized: true }),
      isAuthenticated: () => get().accessToken !== null,
      isAdmin: () => get().user?.role === 'Admin',
    }),
    { name: 'auth' }
  )
)

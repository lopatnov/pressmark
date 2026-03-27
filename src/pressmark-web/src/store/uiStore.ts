import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface UiState {
  sidebarOpen: boolean
  locale: string
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setLocale: (locale: string) => void
}

export const useUiStore = create<UiState>()(
  devtools(
    (set) => ({
      sidebarOpen: true,
      locale: 'en',
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'ui' },
  ),
)

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface Subscription {
  id: string
  rssUrl: string
  title: string
  lastFetchedAt: string
  createdAt: string
  isCommunityBanned: boolean
}

interface SubscriptionState {
  subscriptions: Subscription[]
  isLoading: boolean
  setSubscriptions: (subscriptions: Subscription[]) => void
  addSubscription: (sub: Subscription) => void
  removeSubscription: (id: string) => void
  updateSubscriptionTitle: (id: string, title: string) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useSubscriptionStore = create<SubscriptionState>()(
  devtools(
    (set) => ({
      subscriptions: [],
      isLoading: false,
      setSubscriptions: (subscriptions) => set({ subscriptions }),
      addSubscription: (sub) => set((s) => ({ subscriptions: [...s.subscriptions, sub] })),
      removeSubscription: (id) =>
        set((s) => ({
          subscriptions: s.subscriptions.filter((s) => s.id !== id),
        })),
      updateSubscriptionTitle: (id, title) =>
        set((s) => ({
          subscriptions: s.subscriptions.map((sub) => (sub.id === id ? { ...sub, title } : sub)),
        })),
      setLoading: (isLoading) => set({ isLoading }),
      reset: () => set({ subscriptions: [], isLoading: false }),
    }),
    { name: 'subscriptions' },
  ),
)

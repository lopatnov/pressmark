import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface FeedItem {
  id: string
  subscriptionId: string
  title: string
  url: string
  summary: string
  publishedAt: string
  isRead: boolean
  likeCount: number
  isLiked: boolean
  isBookmarked: boolean
  sourceTitle: string
  imageUrl: string
}

interface FeedState {
  items: FeedItem[]
  nextCursor: string
  totalUnread: number
  isLoading: boolean
  unreadOnly: boolean
  subscriptionIdFilter: string
  setItems: (items: FeedItem[], cursor: string, unread: number) => void
  appendItems: (items: FeedItem[], cursor: string) => void
  prependItem: (item: FeedItem) => void
  setLoading: (loading: boolean) => void
  setFilter: (unreadOnly: boolean, subscriptionId: string) => void
  updateLike: (id: string, isLiked: boolean, likeCount: number) => void
  updateBookmark: (id: string, isBookmarked: boolean) => void
  markRead: (id: string) => void
  reset: () => void
}

export const useFeedStore = create<FeedState>()(
  devtools(
    (set) => ({
      items: [],
      nextCursor: '',
      totalUnread: 0,
      isLoading: false,
      unreadOnly: false,
      subscriptionIdFilter: '',
      setItems: (items, cursor, unread) =>
        set({ items, nextCursor: cursor, totalUnread: unread }),
      appendItems: (items, cursor) =>
        set((s) => ({ items: [...s.items, ...items], nextCursor: cursor })),
      prependItem: (item) =>
        set((s) => ({ items: [item, ...s.items], totalUnread: s.totalUnread + 1 })),
      setLoading: (isLoading) => set({ isLoading }),
      setFilter: (unreadOnly, subscriptionIdFilter) =>
        set({ unreadOnly, subscriptionIdFilter }),
      updateLike: (id, isLiked, likeCount) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, isLiked, likeCount } : i
          ),
        })),
      updateBookmark: (id, isBookmarked) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, isBookmarked } : i
          ),
        })),
      markRead: (id) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, isRead: true } : i)),
          totalUnread: Math.max(0, s.totalUnread - 1),
        })),
      reset: () =>
        set({ items: [], nextCursor: '', totalUnread: 0, isLoading: false }),
    }),
    { name: 'feed' }
  )
)

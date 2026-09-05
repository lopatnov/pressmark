import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

/** Feed article as the store keeps it — the projection every loader must produce. */
export interface FeedItem {
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
  isSourceBanned: boolean
}

interface FeedState {
  items: FeedItem[]
  nextCursor: string
  totalUnread: number
  isLoading: boolean
  unreadOnly: boolean
  setItems: (items: FeedItem[], cursor: string, unread: number) => void
  appendItems: (items: FeedItem[], cursor: string) => void
  prependItem: (item: FeedItem) => void
  setLoading: (loading: boolean) => void
  setUnreadOnly: (unreadOnly: boolean) => void
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
      isLoading: true,
      unreadOnly: false,
      setItems: (items, cursor, unread) => set({ items, nextCursor: cursor, totalUnread: unread }),
      appendItems: (items, cursor) =>
        set((s) => ({ items: [...s.items, ...items], nextCursor: cursor })),
      // The update stream can deliver an article the list already holds — on
      // reconnect the server replays everything newer than the timestamp the
      // client asked from. Re-adding it would show the row twice (duplicate
      // React keys included), inflate the unread count and reset the copy's
      // read/like/bookmark state, so a known id is dropped instead. Returning
      // the state unchanged is what keeps that a no-op for subscribers.
      prependItem: (item) =>
        set((s) =>
          s.items.some((i) => i.id === item.id)
            ? s
            : { items: [item, ...s.items], totalUnread: s.totalUnread + 1 },
        ),
      setLoading: (isLoading) => set({ isLoading }),
      setUnreadOnly: (unreadOnly) => set({ unreadOnly }),
      updateLike: (id, isLiked, likeCount) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, isLiked, likeCount } : i)),
        })),
      updateBookmark: (id, isBookmarked) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, isBookmarked } : i)),
        })),
      markRead: (id) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, isRead: true } : i)),
          totalUnread: Math.max(0, s.totalUnread - 1),
        })),
      reset: () => set({ items: [], nextCursor: '', totalUnread: 0, isLoading: true }),
    }),
    { name: 'feed' },
  ),
)

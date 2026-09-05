import { describe, it, expect, beforeEach } from 'vitest'
import { useFeedStore, type FeedItem } from './feedStore'

function makeItem(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    subscriptionId: 'sub-1',
    title: `Item ${id}`,
    url: '',
    summary: '',
    publishedAt: '',
    isRead: false,
    likeCount: 0,
    isLiked: false,
    isBookmarked: false,
    sourceTitle: '',
    imageUrl: '',
    isSourceBanned: false,
    ...overrides,
  }
}

beforeEach(() => {
  useFeedStore.setState({
    items: [],
    nextCursor: '',
    totalUnread: 0,
    isLoading: false,
    unreadOnly: false,
  })
})

describe('feedStore — prependItem', () => {
  it('prepends a new item and increments the unread count', () => {
    useFeedStore.getState().prependItem(makeItem('1'))

    expect(useFeedStore.getState().items.map((i) => i.id)).toEqual(['1'])
    expect(useFeedStore.getState().totalUnread).toBe(1)
  })

  /**
   * Regression test for the duplicate-row bug fixed alongside useFeedPage's
   * newestPublishedAt: on reconnect the update stream can replay an item the list
   * already holds. Re-adding it duplicated the row (and its React key), inflated
   * the unread badge, and reset the copy's read/like/bookmark state. prependItem
   * now no-ops for an id already present.
   */
  it('is a no-op for an id already present in the list', () => {
    useFeedStore.setState({ items: [makeItem('1')], totalUnread: 1 })

    useFeedStore.getState().prependItem(makeItem('1', { title: 'Replayed copy' }))

    const { items, totalUnread } = useFeedStore.getState()
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Item 1') // untouched — the replay must not overwrite it
    expect(totalUnread).toBe(1)
  })

  it('still prepends a genuinely new id after ignoring a duplicate', () => {
    useFeedStore.setState({ items: [makeItem('1')], totalUnread: 1 })

    useFeedStore.getState().prependItem(makeItem('1')) // duplicate — ignored
    useFeedStore.getState().prependItem(makeItem('2')) // new — prepended

    const { items, totalUnread } = useFeedStore.getState()
    expect(items.map((i) => i.id)).toEqual(['2', '1'])
    expect(totalUnread).toBe(2)
  })
})

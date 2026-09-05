/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FeedPage } from './FeedPage'
import { useFeedStore } from '@/store/feedStore'
import { feedClient } from '@/api/clients'

// ── mocks ─────────────────────────────────────────────────────────────────────
// react-i18next and sonner are mocked globally in src/test-setup.ts

// Captures the load-more callback so tests can trigger it directly, without
// simulating a real IntersectionObserver entry.
let capturedLoadMore: (() => void) | null = null

vi.mock('@/hooks/useIntersectionLoader', () => ({
  useIntersectionLoader: (onIntersect: () => void) => {
    capturedLoadMore = onIntersect
    return { current: null }
  },
}))

vi.mock('@/components/feed/FeedItemCard', () => ({
  FeedItemCard: ({ item }: any) => <div data-testid="feed-item">{item.title}</div>,
}))

vi.mock('@/api/clients', () => ({
  feedClient: {
    getFeed: vi.fn(),
    streamFeedUpdates: vi.fn(),
    toggleLike: vi.fn(),
    toggleBookmark: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}))

// ── helpers ───────────────────────────────────────────────────────────────────

function makeItem(id: string, title: string) {
  return {
    id,
    subscriptionId: 'sub-1',
    title,
    url: '',
    summary: '',
    publishedAt: '',
    isRead: false,
    likeCount: 0,
    isLiked: false,
    isBookmarked: false,
    sourceTitle: '',
    imageUrl: '',
  }
}

function renderFeedPage(initialEntries: string[] = ['/feed']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <FeedPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()

  useFeedStore.setState({
    items: [],
    nextCursor: '',
    totalUnread: 0,
    isLoading: false,
    unreadOnly: false,
  })

  // Default: getFeed resolves with empty page
  vi.mocked(feedClient.getFeed).mockResolvedValue({
    items: [],
    nextCursor: '',
    totalUnread: 0,
  } as any)

  // Default: stream blocks indefinitely until signal is aborted (no items)
  vi.mocked(feedClient.streamFeedUpdates).mockImplementation(async function* (
    _req: unknown,
    opts?: any,
  ) {
    await new Promise<void>((_, reject) => {
      opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    })
  })
})

// ── unreadOnly race condition ─────────────────────────────────────────────────

/**
 * Regression test for the race condition fixed in commit 8dcf4ff.
 *
 * Without the guard `if (signal?.aborted) return`, toggling the unreadOnly
 * checkbox quickly could show stale results from the cancelled first request.
 *
 * With the guard: the first request's AbortSignal is aborted by the cleanup
 * function before the response is processed → setItems is never called →
 * only the second (correct) response appears.
 */
describe('FeedPage — unreadOnly race condition', () => {
  it('shows only the latest request result when the filter is toggled mid-flight', async () => {
    const user = userEvent.setup()

    let resolveFirstCall!: () => void
    let firstCallSignal!: AbortSignal
    let callCount = 0

    vi.mocked(feedClient.getFeed).mockImplementation(async (_req: unknown, opts?: any) => {
      callCount++
      if (callCount === 1) {
        firstCallSignal = opts?.signal as AbortSignal
        // Suspend the first call until explicitly resolved
        await new Promise<void>((resolve) => {
          resolveFirstCall = resolve
        })
        return { items: [makeItem('1', 'First Result')], nextCursor: '', totalUnread: 0 } as any
      }
      // Second call resolves immediately with a distinct title
      return { items: [makeItem('2', 'Unread Result')], nextCursor: '', totalUnread: 0 } as any
    })

    renderFeedPage()

    // Wait for the first getFeed call to start (effect has fired)
    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))

    // Clicking the checkbox → useEffect cleanup aborts controller1 and
    // a new effect fires with controller2, triggering the second getFeed call
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    // Second request resolves immediately → Unread Result must appear
    await screen.findByText('Unread Result')

    // Now let the first (already-aborted) call's promise resolve
    act(() => resolveFirstCall())

    // Guard `if (signal?.aborted) return` prevents setItems from being called
    // for the stale first response → First Result must NOT appear
    await waitFor(() => {
      expect(screen.queryByText('First Result')).not.toBeInTheDocument()
    })
    expect(firstCallSignal.aborted).toBe(true)
  })
})

// ── load-more / filter-change race condition ────────────────────────────────

/**
 * Regression test for the race fixed by extracting useLatestRequest: handleLoadMore
 * used to call loadFeed(cursor) with no AbortSignal at all, so a load-more request
 * in flight when the filter changed could not be cancelled. Its late response still
 * passed the (truthy) cursor check and got appended onto the list the filter change
 * had already replaced, splicing a stale item in under a stale nextCursor.
 *
 * With the fix, handleLoadMore and the filter-change effect share one AbortController
 * via useLatestRequest, so starting the filter-change reload aborts the load-more
 * that was still in flight.
 */
describe('FeedPage — load-more race condition', () => {
  it('discards a late load-more response after the filter changes mid-flight', async () => {
    const user = userEvent.setup()

    let resolveLoadMore!: () => void
    let loadMoreSignal!: AbortSignal
    let callCount = 0

    vi.mocked(feedClient.getFeed).mockImplementation(async (_req: unknown, opts?: any) => {
      callCount++
      if (callCount === 1) {
        // Initial page load: one item, plus a cursor so load-more is available.
        return {
          items: [makeItem('a1', 'Page A Item 1')],
          nextCursor: 'cursor-a',
          totalUnread: 0,
        } as any
      }
      if (callCount === 2) {
        // Load-more for the original filter: suspended until explicitly resolved.
        loadMoreSignal = opts?.signal as AbortSignal
        await new Promise<void>((resolve) => {
          resolveLoadMore = resolve
        })
        return {
          items: [makeItem('a2-stale', 'Stale Load-More Item')],
          nextCursor: 'stale-cursor',
          totalUnread: 0,
        } as any
      }
      // Third call: the filter-change reload, resolves immediately.
      return {
        items: [makeItem('b1', 'Page B Item 1')],
        nextCursor: 'cursor-b',
        totalUnread: 0,
      } as any
    })

    renderFeedPage()

    await screen.findByText('Page A Item 1')

    // Trigger load-more directly via the captured IntersectionObserver callback.
    act(() => capturedLoadMore?.())
    await waitFor(() => expect(callCount).toBe(2))

    // Change the filter while the load-more is still in flight — the effect
    // cleanup aborts the load-more, then starts a fresh request for the new filter.
    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    await screen.findByText('Page B Item 1')
    expect(useFeedStore.getState().nextCursor).toBe('cursor-b')

    // Now let the stale (already-aborted) load-more response resolve.
    act(() => resolveLoadMore())

    // The stale item must never appear, and nextCursor must still belong to the
    // new filter — a regression would splice the stale item onto the list and
    // overwrite nextCursor with the stale one.
    await waitFor(() => {
      expect(screen.queryByText('Stale Load-More Item')).not.toBeInTheDocument()
    })
    expect(useFeedStore.getState().nextCursor).toBe('cursor-b')
    expect(loadMoreSignal.aborted).toBe(true)
  })
})

// ── unmount during streaming ──────────────────────────────────────────────────

/**
 * Regression test for the memory leak fixed in commit 8dcf4ff.
 *
 * The streaming useEffect returns `() => controller.abort()` as its cleanup.
 * When the component unmounts, the cleanup fires, the AbortSignal is marked
 * aborted, and the async generator throws → the for-await loop exits without
 * calling prependItem again.
 *
 * Without the fix, the generator would keep running after unmount, calling
 * prependItem on an unmounted component's Zustand store indefinitely.
 */
describe('FeedPage — unmount during streaming', () => {
  it('aborts the stream on unmount and adds no items after cleanup', async () => {
    let streamSignal!: AbortSignal
    let streamStarted = false

    vi.mocked(feedClient.streamFeedUpdates).mockImplementation(async function* (
      _req: unknown,
      opts?: any,
    ) {
      streamStarted = true
      streamSignal = opts?.signal as AbortSignal

      // Yield one item so the component confirms the stream is active
      yield makeItem('streamed-1', 'Streamed Item') as any

      // Then block until the signal is aborted (simulates a long-lived stream)
      await new Promise<void>((_, reject) => {
        opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    })

    const { unmount } = renderFeedPage()

    // Wait for the stream to start and the first item to be prepended
    await waitFor(() => expect(streamStarted).toBe(true))
    await screen.findByText('Streamed Item')

    const itemCountBeforeUnmount = useFeedStore.getState().items.length
    expect(itemCountBeforeUnmount).toBe(1)

    // Unmount → effect cleanup → controller.abort()
    unmount()

    // Drain pending microtasks
    await new Promise((r) => setTimeout(r, 30))

    // Cleanup must have aborted the signal
    expect(streamSignal.aborted).toBe(true)
    // No additional items prepended after unmount
    expect(useFeedStore.getState().items.length).toBe(itemCountBeforeUnmount)
  })
})

// ── mark-all-read subscription scope ────────────────────────────────────────

/**
 * Regression test for the bug fixed alongside FeedPageAssembler's TotalUnread
 * scoping: markAllRead() used to always send subscriptionId: '' regardless of
 * the active source filter, so clicking "mark all as read" while filtered to
 * one subscription silently marked every article across every subscription
 * as read.
 */
describe('FeedPage — mark-all-read subscription scope', () => {
  it('sends the active subscription id when a source filter is active', async () => {
    const user = userEvent.setup()

    vi.mocked(feedClient.getFeed).mockResolvedValue({
      items: [makeItem('1', 'Filtered Item')],
      nextCursor: '',
      totalUnread: 3,
    } as any)
    vi.mocked(feedClient.markAllAsRead).mockResolvedValue({} as any)

    renderFeedPage(['/feed?sub=sub-1'])

    const button = await screen.findByRole('button', { name: 'feed:markAllRead' })
    await user.click(button)

    await waitFor(() =>
      expect(feedClient.markAllAsRead).toHaveBeenCalledWith({ subscriptionId: 'sub-1' }),
    )
  })

  it('sends an empty subscription id when no source filter is active', async () => {
    const user = userEvent.setup()

    vi.mocked(feedClient.getFeed).mockResolvedValue({
      items: [makeItem('1', 'Unfiltered Item')],
      nextCursor: '',
      totalUnread: 3,
    } as any)
    vi.mocked(feedClient.markAllAsRead).mockResolvedValue({} as any)

    renderFeedPage(['/feed'])

    const button = await screen.findByRole('button', { name: 'feed:markAllRead' })
    await user.click(button)

    await waitFor(() =>
      expect(feedClient.markAllAsRead).toHaveBeenCalledWith({ subscriptionId: '' }),
    )
  })
})

// ── streamed item mapping (toFeedItem) ──────────────────────────────────────

/**
 * Regression test for the toFeedItem extraction in useFeedPage: the live update
 * stream now projects each wire item through the shared toFeedItem mapper
 * instead of a hand-copied field list, so a streamed item must still land in
 * the store with every field populated correctly.
 */
describe('FeedPage — streamed item mapping (toFeedItem)', () => {
  it('maps every field of a streamed item into the store', async () => {
    const streamedItem = {
      id: 'streamed-full',
      subscriptionId: 'sub-full',
      title: 'Full Field Title',
      url: 'https://example.com/full-field-article',
      summary: 'Full field summary text',
      publishedAt: '2026-08-08T12:00:00Z',
      isRead: false,
      likeCount: 7,
      isLiked: true,
      isBookmarked: true,
      sourceTitle: 'Full Field Source',
      imageUrl: 'https://example.com/full-field.png',
      isSourceBanned: true,
    }

    vi.mocked(feedClient.streamFeedUpdates).mockImplementation(async function* (
      _req: unknown,
      opts?: any,
    ) {
      yield streamedItem as any
      await new Promise<void>((_, reject) => {
        opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    })

    renderFeedPage()

    await screen.findByText('Full Field Title')

    expect(useFeedStore.getState().items[0]).toEqual(streamedItem)
  })
})

// ── stream reconnect replay point (newestPublishedAt) ───────────────────────

/**
 * Regression test for the reconnect replay bug: a broadcast batch of new
 * articles arrives newest-first, so as each one is prepended the batch's
 * *oldest* article ends up on top of the list (items[0]) — the list is ordered
 * by arrival, not by publish date. Asking the server to replay from
 * items[0].publishedAt on reconnect therefore replayed the rest of that same
 * batch every time: duplicate rows, duplicate React keys, an inflated unread
 * badge.
 *
 * The fix (newestPublishedAt in useFeedPage) replays from the newest publishedAt
 * in the list instead of items[0]. This drives that through the real reconnect
 * path: the first stream call delivers a newest-first batch and ends cleanly
 * (not an error, since the fix also retries on a clean end) to trigger the 5s
 * backoff retry, and the second call's sinceTimestamp is asserted against the
 * newest item's timestamp rather than the batch's last-arrived (oldest) item.
 */
describe('FeedPage — stream reconnect replay point (newestPublishedAt)', () => {
  it('replays from the newest item in the list on reconnect, not items[0]', async () => {
    vi.useFakeTimers()
    try {
      // Irrelevant to this test — left pending so it cannot race with the
      // stream's prepends via its own (unrelated) setItems([]) call.
      vi.mocked(feedClient.getFeed).mockReturnValue(new Promise(() => {}))

      const sinceTimestamps: string[] = []
      let callCount = 0

      vi.mocked(feedClient.streamFeedUpdates).mockImplementation((req: any, opts?: any) => {
        callCount++
        sinceTimestamps.push(req.sinceTimestamp)
        if (callCount === 1) {
          // A broadcast batch delivered newest-first: prepending each one in
          // turn leaves the *oldest* of the two on top of the list.
          return (async function* () {
            yield {
              ...makeItem('batch-newest', 'Newest'),
              publishedAt: '2026-01-01T10:05:00.000Z',
            } as any
            yield {
              ...makeItem('batch-oldest', 'Oldest'),
              publishedAt: '2026-01-01T10:00:00.000Z',
            } as any
            // Clean end — no throw — must still trigger the retry below.
          })()
        }
        // Reconnect call: block forever, nothing else to assert on it.
        return (async function* () {
          await new Promise<void>((_, reject) => {
            opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          })
        })()
      })

      renderFeedPage()

      // Drain the microtask queue (fake timers leave those untouched) until
      // both items of the batch have been prepended into the store — the
      // store update is synchronous, so this does not depend on React having
      // re-rendered yet.
      for (let i = 0; i < 20 && useFeedStore.getState().items.length < 2; i++) {
        await vi.advanceTimersByTimeAsync(0)
      }
      expect(useFeedStore.getState().items.map((i) => i.id)).toEqual([
        'batch-oldest',
        'batch-newest',
      ])

      await vi.advanceTimersByTimeAsync(5000)

      expect(callCount).toBe(2)
      // Must replay from the newest publishedAt in the list, not items[0] (the
      // batch's oldest article, left on top by arrival order).
      expect(sinceTimestamps[1]).toBe('2026-01-01T10:05:00.000Z')
    } finally {
      vi.useRealTimers()
    }
  })
})

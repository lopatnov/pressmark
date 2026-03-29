/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FeedPage } from './FeedPage'
import { useFeedStore } from '@/store/feedStore'
import { feedClient } from '@/api/clients'

// ── mocks ─────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => {
  // Stable reference — if recreated on every call, it lands in useCallback deps
  // and causes infinite re-renders in components that include `t` as a dep.
  const t = (key: string) => key
  return {
    useTranslation: () => ({ t }),
  }
})

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

vi.mock('@/hooks/useIntersectionLoader', () => ({
  useIntersectionLoader: () => ({ current: null }),
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

function renderFeedPage() {
  return render(
    <MemoryRouter>
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
    subscriptionIdFilter: '',
  })

  // Default: getFeed resolves with empty page
  vi.mocked(feedClient.getFeed).mockResolvedValue({
    items: [],
    nextCursor: '',
    totalUnread: 0,
  } as any)

  // Default: stream blocks indefinitely until signal is aborted (no items)
  vi.mocked(feedClient.streamFeedUpdates).mockImplementation(
    // eslint-disable-next-line require-yield
    async function* (_req: unknown, opts?: any) {
      await new Promise<void>((_, reject) => {
        opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    },
  )
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

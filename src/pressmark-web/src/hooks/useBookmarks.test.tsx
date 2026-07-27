/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useBookmarks } from './useBookmarks'
import { feedClient } from '@/api/clients'

// ── mocks ─────────────────────────────────────────────────────────────────────
// react-i18next and sonner are mocked globally in src/test-setup.ts

vi.mock('@/hooks/useIntersectionLoader', () => ({
  useIntersectionLoader: () => ({ current: null }),
}))

vi.mock('@/api/clients', () => ({
  feedClient: {
    getBookmarks: vi.fn(),
    toggleBookmark: vi.fn(),
  },
}))

// ── helpers ───────────────────────────────────────────────────────────────────

function makeItem(id: string, title: string) {
  return {
    id,
    title,
    url: '',
    summary: '',
    publishedAt: '',
    likeCount: 0,
    sourceTitle: '',
    subscriptionId: 'sub-1',
    isSourceBanned: false,
  }
}

/** Minimal host so the hook can be driven by changing the source filter. */
function Harness({ activeSubId }: { activeSubId: string }) {
  const { items, removeBookmark } = useBookmarks(activeSubId)
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <button onClick={() => removeBookmark(item.id)}>{item.title}</button>
        </li>
      ))}
    </ul>
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(feedClient.getBookmarks).mockResolvedValue({ items: [], nextCursor: '' } as any)
})

// ── source filter race condition ──────────────────────────────────────────────

/**
 * BookmarksPage used to own this load itself with no AbortController, so
 * switching the `sub` filter mid-flight let the previous filter's response land
 * on top of the current list. useBookmarks aborts the in-flight request the same
 * way useFeedPage/useCommunityFeed do.
 */
describe('useBookmarks — source filter race condition', () => {
  it('drops the response of a request that a filter change already replaced', async () => {
    let resolveFirstCall!: () => void
    let firstCallSignal!: AbortSignal
    let callCount = 0

    vi.mocked(feedClient.getBookmarks).mockImplementation(async (_req: unknown, opts?: any) => {
      callCount++
      if (callCount === 1) {
        firstCallSignal = opts?.signal as AbortSignal
        await new Promise<void>((resolve) => {
          resolveFirstCall = resolve
        })
        return { items: [makeItem('1', 'Stale Result')], nextCursor: '' } as any
      }
      return { items: [makeItem('2', 'Filtered Result')], nextCursor: '' } as any
    })

    const { rerender } = render(<Harness activeSubId="" />)
    await waitFor(() => expect(callCount).toBeGreaterThanOrEqual(1))

    // Changing the filter aborts controller 1 and starts a second request
    rerender(<Harness activeSubId="sub-9" />)
    await screen.findByText('Filtered Result')

    // Let the already-aborted first call settle
    act(() => resolveFirstCall())

    await waitFor(() => {
      expect(screen.queryByText('Stale Result')).not.toBeInTheDocument()
    })
    expect(firstCallSignal.aborted).toBe(true)
  })

  it('requests the bookmarks scoped to the active subscription', async () => {
    render(<Harness activeSubId="sub-42" />)
    await waitFor(() => expect(feedClient.getBookmarks).toHaveBeenCalled())
    expect(vi.mocked(feedClient.getBookmarks).mock.calls[0][0]).toMatchObject({
      subscriptionId: 'sub-42',
      cursor: '',
    })
  })
})

// ── un-bookmarking ────────────────────────────────────────────────────────────

describe('useBookmarks — removeBookmark', () => {
  it('drops the row once the server confirms', async () => {
    vi.mocked(feedClient.getBookmarks).mockResolvedValue({
      items: [makeItem('1', 'Keep me')],
      nextCursor: '',
    } as any)
    vi.mocked(feedClient.toggleBookmark).mockResolvedValue({ isBookmarked: false } as any)

    render(<Harness activeSubId="" />)
    const button = await screen.findByText('Keep me')

    await act(async () => button.click())

    await waitFor(() => expect(screen.queryByText('Keep me')).not.toBeInTheDocument())
  })

  it('keeps the row when the server refuses', async () => {
    vi.mocked(feedClient.getBookmarks).mockResolvedValue({
      items: [makeItem('1', 'Keep me')],
      nextCursor: '',
    } as any)
    vi.mocked(feedClient.toggleBookmark).mockRejectedValue(new Error('nope'))

    render(<Harness activeSubId="" />)
    const button = await screen.findByText('Keep me')

    await act(async () => button.click())

    expect(screen.getByText('Keep me')).toBeInTheDocument()
  })
})

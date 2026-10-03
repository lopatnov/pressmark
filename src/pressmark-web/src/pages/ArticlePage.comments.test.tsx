/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ArticlePage } from './ArticlePage'
import { feedClient } from '@/api/clients'

// react-i18next and sonner are mocked globally in src/test-setup.ts
// Unlike ArticlePage.test.tsx, the comment thread is real here: these tests cover
// how the page drives it.

vi.mock('@/components/feed/FeedItemCard', () => ({
  FeedItemCard: ({ item }: any) => <div data-testid="article">{item.title}</div>,
}))

vi.mock('@/api/clients', () => ({
  feedClient: {
    getFeedItem: vi.fn(),
    listComments: vi.fn(),
  },
  adminClient: {},
}))

function makeArticle(id: string) {
  return {
    id,
    title: `Article ${id}`,
    url: '',
    summary: '',
    publishedAt: '',
    sourceTitle: '',
    imageUrl: '',
    subscriptionId: 'sub-1',
    sourceRssUrl: '',
    isHidden: false,
    isSourceBanned: false,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(feedClient.getFeedItem).mockImplementation(
    async (req: any) => makeArticle(req.feedItemId) as any,
  )
  vi.mocked(feedClient.listComments).mockResolvedValue({ items: [], isSubscribed: false } as any)
})

describe('ArticlePage — comment thread', () => {
  /**
   * The thread used to follow the route id, which changes one render before the
   * displayed article does, so every navigation also fired a load for the next
   * article from the thread that was about to unmount.
   */
  it('loads each article’s thread once when navigating between articles', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/article/a']}>
        <Link to="/article/b">go-next</Link>
        <Routes>
          <Route path="/article/:id" element={<ArticlePage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByTestId('article')).toHaveTextContent('Article a'))

    await user.click(screen.getByText('go-next'))
    await waitFor(() => expect(screen.getByTestId('article')).toHaveTextContent('Article b'))
    await waitFor(() => expect(feedClient.listComments).toHaveBeenCalledTimes(2))

    const requested = vi.mocked(feedClient.listComments).mock.calls.map(([req]) => req.feedItemId)
    expect(requested).toEqual(['a', 'b'])
  })
})

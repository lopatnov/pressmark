/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ArticlePage } from './ArticlePage'
import { feedClient } from '@/api/clients'
import { useAuthStore } from '@/store/authStore'

// ── mocks ─────────────────────────────────────────────────────────────────────
// react-i18next and sonner are mocked globally in src/test-setup.ts

// The comment thread does its own RPC and is not what these tests cover
vi.mock('@/components/feed/CommentSection', () => ({
  CommentSection: () => null,
}))

vi.mock('@/components/feed/FeedItemCard', () => ({
  FeedItemCard: ({ item }: any) => <div data-testid="article">{item.title}</div>,
}))

vi.mock('@/api/clients', () => ({
  feedClient: {
    getFeedItem: vi.fn(),
    reportContent: vi.fn(),
  },
  adminClient: {
    hideFeedItem: vi.fn(),
  },
}))

// ── helpers ───────────────────────────────────────────────────────────────────

function makeArticle(id: string, title: string) {
  return {
    id,
    title,
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

/** Renders the article route plus a link that navigates to another article. */
function renderArticleRoute(initialId: string, linkToId: string) {
  return render(
    <MemoryRouter initialEntries={[`/article/${initialId}`]}>
      <Link to={`/article/${linkToId}`}>go-next</Link>
      <Routes>
        <Route path="/article/:id" element={<ArticlePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  useAuthStore.setState({ accessToken: null, user: null })
})

// ── stale not-found state ─────────────────────────────────────────────────────

/**
 * Regression test: ArticlePage owned `notFound` itself and never reset it when
 * the :id route param changed, so navigating from a missing article to a valid
 * one kept rendering "Article not found" over the freshly loaded article.
 */
describe('ArticlePage — navigating between articles', () => {
  it('clears the not-found state when the id changes', async () => {
    const user = userEvent.setup()

    vi.mocked(feedClient.getFeedItem).mockImplementation(async (req: any) => {
      if (req.feedItemId === 'missing') throw new Error('not found')
      return makeArticle('good', 'A Real Article') as any
    })

    renderArticleRoute('missing', 'good')

    await screen.findByText('feed:article.notFound')

    await user.click(screen.getByText('go-next'))

    await screen.findByTestId('article')
    expect(screen.getByTestId('article')).toHaveTextContent('A Real Article')
    expect(screen.queryByText('feed:article.notFound')).not.toBeInTheDocument()
  })

  it('does not leave the previous article on screen while the next one loads', async () => {
    const user = userEvent.setup()
    let resolveSecond!: (value: any) => void

    vi.mocked(feedClient.getFeedItem).mockImplementation(async (req: any) => {
      if (req.feedItemId === 'first') return makeArticle('first', 'First Article') as any
      return new Promise((resolve) => {
        resolveSecond = resolve
      })
    })

    renderArticleRoute('first', 'second')

    await waitFor(() => expect(screen.getByTestId('article')).toHaveTextContent('First Article'))

    await user.click(screen.getByText('go-next'))

    // The stale article must be gone before the new one arrives
    await waitFor(() => expect(screen.queryByTestId('article')).not.toBeInTheDocument())

    resolveSecond(makeArticle('second', 'Second Article'))
    await waitFor(() => expect(screen.getByTestId('article')).toHaveTextContent('Second Article'))
  })

  it('renders the article when it loads successfully', async () => {
    vi.mocked(feedClient.getFeedItem).mockResolvedValue(makeArticle('good', 'Hello') as any)

    renderArticleRoute('good', 'other')

    await screen.findByTestId('article')
    expect(screen.getByTestId('article')).toHaveTextContent('Hello')
    expect(screen.queryByText('feed:article.notFound')).not.toBeInTheDocument()
  })
})

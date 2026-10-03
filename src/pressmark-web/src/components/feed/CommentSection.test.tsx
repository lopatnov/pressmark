/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CommentSection } from './CommentSection'
import { feedClient } from '@/api/clients'
import { useAuthStore } from '@/store/authStore'

// react-i18next and sonner are mocked globally in src/test-setup.ts

vi.mock('@/api/clients', () => ({
  feedClient: {
    listComments: vi.fn(),
    addComment: vi.fn(),
    toggleCommentSubscription: vi.fn(),
    reportContent: vi.fn(),
  },
  adminClient: {
    removeComment: vi.fn(),
  },
}))

function makeComment(id: string, body: string) {
  return {
    id,
    userEmail: 'someone@example.com',
    body,
    createdAt: '2026-01-01T00:00:00Z',
    removedByAdmin: false,
    isCommentingBanned: false,
  }
}

function thread(...comments: ReturnType<typeof makeComment>[]) {
  return { items: comments, isSubscribed: false } as any
}

beforeEach(() => {
  vi.resetAllMocks()
  useAuthStore.setState({
    accessToken: 'token',
    user: { id: 'u1', email: 'me@example.com', role: 'User' },
    commentsEnabled: true,
  })
})

describe('CommentSection', () => {
  it('loads the thread on first open and appends a posted comment', async () => {
    const user = userEvent.setup()
    vi.mocked(feedClient.listComments).mockResolvedValue(thread(makeComment('c1', 'First!')))
    vi.mocked(feedClient.addComment).mockResolvedValue(makeComment('c2', 'Second') as any)
    render(<CommentSection feedItemId="a" />)

    expect(feedClient.listComments).not.toHaveBeenCalled()
    await user.click(screen.getByLabelText('comments.toggle'))
    await screen.findByText('First!')

    const input = screen.getByPlaceholderText('comments.placeholder')
    await user.type(input, '  Second  ')
    await user.click(screen.getByRole('button', { name: 'comments.submit' }))

    await screen.findByText('Second')
    expect(feedClient.addComment).toHaveBeenCalledWith({ feedItemId: 'a', body: 'Second' })
    expect(input).toHaveValue('')
    expect(feedClient.listComments).toHaveBeenCalledTimes(1)
  })

  it('drops a late response for an article the section has moved off', async () => {
    let resolveFirst!: (value: any) => void
    vi.mocked(feedClient.listComments).mockImplementation(async (req: any) =>
      req.feedItemId === 'a'
        ? new Promise((resolve) => {
            resolveFirst = resolve
          })
        : thread(makeComment('b1', 'About B')),
    )
    const { rerender } = render(<CommentSection feedItemId="a" initiallyOpen />)
    rerender(<CommentSection feedItemId="b" initiallyOpen />)
    await screen.findByText('About B')

    resolveFirst(thread(makeComment('a1', 'About A')))

    await waitFor(() => expect(screen.queryByText('About A')).not.toBeInTheDocument())
    expect(screen.getByText('About B')).toBeInTheDocument()
  })

  it('marks a reported comment and closes the report form', async () => {
    const user = userEvent.setup()
    vi.mocked(feedClient.listComments).mockResolvedValue(thread(makeComment('c1', 'Spam')))
    vi.mocked(feedClient.reportContent).mockResolvedValue({} as any)
    render(<CommentSection feedItemId="a" initiallyOpen />)
    await screen.findByText('Spam')

    await user.click(screen.getByLabelText('reportComment'))
    await user.type(screen.getByLabelText('reportReason'), 'advertising')
    await user.click(screen.getByRole('button', { name: 'reportSend' }))

    await waitFor(() =>
      expect(feedClient.reportContent).toHaveBeenCalledWith({
        type: 'comment',
        targetId: 'c1',
        reason: 'advertising',
      }),
    )
    await waitFor(() => expect(screen.queryByLabelText('reportReason')).not.toBeInTheDocument())
    expect(screen.queryByLabelText('reportComment')).not.toBeInTheDocument()
  })
})

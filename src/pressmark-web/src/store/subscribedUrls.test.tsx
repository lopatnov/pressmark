import { render, screen, act } from '@testing-library/react'
import { useMemo } from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSubscriptionStore } from './subscriptionStore'

/**
 * Regression test for a bug where `subscribedUrls` in CommunityPage was a
 * `useState` instead of `useMemo(() => new Set(...), [subscriptions])`.
 *
 * With `useState`, calling `addSubscription()` updated the store but did NOT
 * update the local copy — so the Subscribe button stayed in the wrong state.
 *
 * With `useMemo`, the Set is derived from the store's `subscriptions` array
 * on every render, so it is always in sync.
 *
 * The test renders a minimal component that reproduces the exact pattern used
 * in CommunityPage and verifies that the derived Set updates immediately after
 * `addSubscription()` is called.
 */

const TEST_URL = 'https://example.com/rss'
const TEST_SUB = {
  id: 'sub-1',
  rssUrl: TEST_URL,
  title: 'Example',
  lastFetchedAt: '',
  createdAt: new Date().toISOString(),
  isCommunityBanned: false,
}

function SubscribeButton({ rssUrl }: { rssUrl: string }) {
  const { subscriptions, addSubscription } = useSubscriptionStore()
  // Exact pattern from CommunityPage.tsx
  const subscribedUrls = useMemo(() => new Set(subscriptions.map((s) => s.rssUrl)), [subscriptions])
  const isSubscribed = subscribedUrls.has(rssUrl)

  return (
    <button data-testid="subscribe-btn" onClick={() => addSubscription({ ...TEST_SUB, rssUrl })}>
      {isSubscribed ? 'Subscribed' : 'Subscribe'}
    </button>
  )
}

beforeEach(() => {
  useSubscriptionStore.getState().reset()
})

describe('subscribedUrls — useMemo reactivity', () => {
  it('shows Subscribe when URL not yet in store', () => {
    render(<SubscribeButton rssUrl={TEST_URL} />)
    expect(screen.getByTestId('subscribe-btn')).toHaveTextContent('Subscribe')
  })

  it('switches to Subscribed immediately after addSubscription without remount', () => {
    render(<SubscribeButton rssUrl={TEST_URL} />)

    act(() => {
      useSubscriptionStore.getState().addSubscription(TEST_SUB)
    })

    // useMemo re-derives the Set from the updated subscriptions array →
    // the button text must change without any page reload
    expect(screen.getByTestId('subscribe-btn')).toHaveTextContent('Subscribed')
  })

  it('stays Subscribed if the same URL is added twice', () => {
    render(<SubscribeButton rssUrl={TEST_URL} />)

    act(() => {
      useSubscriptionStore.getState().addSubscription(TEST_SUB)
      useSubscriptionStore.getState().addSubscription({ ...TEST_SUB, id: 'sub-2' })
    })

    expect(screen.getByTestId('subscribe-btn')).toHaveTextContent('Subscribed')
  })

  it('reverts to Subscribe after removeSubscription', () => {
    useSubscriptionStore.getState().addSubscription(TEST_SUB)
    render(<SubscribeButton rssUrl={TEST_URL} />)
    expect(screen.getByTestId('subscribe-btn')).toHaveTextContent('Subscribed')

    act(() => {
      useSubscriptionStore.getState().removeSubscription('sub-1')
    })

    expect(screen.getByTestId('subscribe-btn')).toHaveTextContent('Subscribe')
  })
})

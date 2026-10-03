import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useAdminPaginatedList, ADMIN_PAGE_SIZE } from './useAdminPaginatedList'

// react-i18next and sonner are mocked globally in src/test-setup.ts

function rows(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}` }))
}

describe('useAdminPaginatedList — removeItem', () => {
  /**
   * The banned-sources and hidden-articles sections used to reload the current page
   * after a removal, so taking the only row off page 2 left the admin on an empty
   * "page 2 of 1" with the earlier pages out of reach.
   */
  it('steps back a page when the last row of a later page is removed', async () => {
    const fetchPage = vi.fn(async (page: number) =>
      page === 0
        ? { items: rows('p0', ADMIN_PAGE_SIZE), totalCount: ADMIN_PAGE_SIZE + 1 }
        : { items: rows('p1', 1), totalCount: ADMIN_PAGE_SIZE + 1 },
    )
    const { result } = renderHook(() => useAdminPaginatedList(fetchPage))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.handlePage(1))
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'p1-0' }]))

    // What the server reports once the row is gone.
    fetchPage.mockImplementation(async () => ({
      items: rows('p0', ADMIN_PAGE_SIZE),
      totalCount: ADMIN_PAGE_SIZE,
    }))
    act(() => result.current.removeItem('p1-0'))

    await waitFor(() => expect(result.current.items).toHaveLength(ADMIN_PAGE_SIZE))
    expect(result.current.page).toBe(0)
    expect(result.current.totalPages).toBe(1)
    expect(fetchPage).toHaveBeenLastCalledWith(0)
    // Mount + handlePage(1) + exactly one reconcile — stepping back must not
    // also re-fire while settling onto the page it stepped back to.
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  it('stays on the first page when its last row is removed', async () => {
    const fetchPage = vi.fn(async () => ({ items: rows('r', 1), totalCount: 1 }))
    const { result } = renderHook(() => useAdminPaginatedList(fetchPage))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.removeItem('r-0'))

    expect(result.current.items).toEqual([])
    expect(result.current.page).toBe(0)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  /**
   * Two quick clicks on different rows both await their RPC with handlers from the
   * same render; filtering a captured copy of the list let the second removal put
   * the first row back.
   */
  it('keeps both rows out when two removals land back to back', async () => {
    const fetchPage = vi.fn(async () => ({ items: rows('r', 3), totalCount: 3 }))
    const { result } = renderHook(() => useAdminPaginatedList(fetchPage))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const { removeItem } = result.current
    act(() => {
      removeItem('r-0')
      removeItem('r-1')
    })

    expect(result.current.items).toEqual([{ id: 'r-2' }])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  /**
   * Removing a row from a page that isn't the list's last leaves every row after
   * it one offset short of what the server would now return for this page — the
   * row that should have slid up from the next page is missing until this page is
   * refetched.
   */
  it('backfills the row that slides up from the next page after a removal', async () => {
    const fetchPage = vi.fn(async () => ({
      items: rows('p0', ADMIN_PAGE_SIZE),
      totalCount: ADMIN_PAGE_SIZE + 5,
    }))
    const { result } = renderHook(() => useAdminPaginatedList(fetchPage))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // What the server reports once the row is gone and the next page's first
    // row has slid up to fill this one.
    fetchPage.mockImplementation(async () => ({
      items: [...rows('p0', ADMIN_PAGE_SIZE).slice(1), { id: 'p1-0' }],
      totalCount: ADMIN_PAGE_SIZE + 4,
    }))
    act(() => result.current.removeItem('p0-0'))

    // Optimistic local state right after removeItem: one row short, stale total.
    expect(result.current.items).toHaveLength(ADMIN_PAGE_SIZE - 1)
    expect(result.current.loading).toBe(false) // reconciles silently, no skeleton

    await waitFor(() => expect(result.current.items).toHaveLength(ADMIN_PAGE_SIZE))
    expect(result.current.items.at(-1)).toEqual({ id: 'p1-0' })
    expect(result.current.page).toBe(0)
    expect(fetchPage).toHaveBeenLastCalledWith(0)
  })

  /**
   * Clearing every row on page 0 in one go (a bulk action) while later pages
   * still exist used to leave the admin on a blank page 0 forever — the old
   * step-back rule only fired past the first page, so page 0 was never reloaded
   * to pull the rest of the list in.
   */
  it('refills page 0 after all its rows are removed when later pages exist', async () => {
    const fetchPage = vi.fn(async () => ({
      items: rows('p0', ADMIN_PAGE_SIZE),
      totalCount: ADMIN_PAGE_SIZE + 1,
    }))
    const { result } = renderHook(() => useAdminPaginatedList(fetchPage))
    await waitFor(() => expect(result.current.loading).toBe(false))

    fetchPage.mockImplementation(async () => ({ items: rows('p1', 1), totalCount: 1 }))
    act(() => {
      for (let i = 0; i < ADMIN_PAGE_SIZE; i++) result.current.removeItem(`p0-${i}`)
    })

    await waitFor(() => expect(result.current.items).toEqual([{ id: 'p1-0' }]))
    expect(result.current.page).toBe(0)
    expect(fetchPage).toHaveBeenLastCalledWith(0)
  })

  /**
   * A reconcile fetch started for an earlier removal can still be in flight when
   * a second row is removed. Applying its response wholesale would overwrite the
   * second removal's own (newer) local state and put that row back.
   */
  it('does not resurrect a row removed while an earlier reconcile fetch is still in flight', async () => {
    const fetchPage = vi.fn(async () => ({
      items: rows('r', ADMIN_PAGE_SIZE),
      totalCount: ADMIN_PAGE_SIZE + 1,
    }))
    const { result } = renderHook(() => useAdminPaginatedList(fetchPage))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let resolveReconcile!: (value: { items: { id: string }[]; totalCount: number }) => void
    fetchPage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveReconcile = resolve
        }),
    )
    // What a further reconcile sees once both removals have actually landed.
    fetchPage.mockResolvedValue({
      items: [...rows('r', ADMIN_PAGE_SIZE).slice(2), { id: 'r-20' }],
      totalCount: ADMIN_PAGE_SIZE - 1,
    })

    act(() => result.current.removeItem('r-0'))
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2))

    act(() => result.current.removeItem('r-1'))
    expect(result.current.items.some((item) => item.id === 'r-1')).toBe(false)

    // What the server reports from the request that started before r-1 was
    // removed: a full, internally consistent page (20 of 20 expected) that
    // still carries r-1 — nothing about its shape alone calls for a further
    // reconcile, so only explicitly remembering r-1 as removed keeps it out.
    resolveReconcile({
      items: [...rows('r', ADMIN_PAGE_SIZE).slice(1), { id: 'r-20' }],
      totalCount: ADMIN_PAGE_SIZE,
    })

    await waitFor(() => expect(result.current.items.some((item) => item.id === 'r-20')).toBe(true))
    expect(result.current.items.some((item) => item.id === 'r-1')).toBe(false)
  })
})

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
})

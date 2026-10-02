import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export const ADMIN_PAGE_SIZE = 20

interface PageResult<T> {
  items: T[]
  totalCount: number
}

/**
 * Offset pagination for the admin list sections: loads a page, tracks the total
 * for the pager, and drops a superseded response so a slow page can't land on top
 * of the one the admin has since moved to.
 */
export function useAdminPaginatedList<T extends { id: string }>(
  fetchPage: (page: number) => Promise<PageResult<T>>,
  errorKey = 'common:error',
) {
  const { t } = useTranslation()
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage

  const [items, setItems] = useState<T[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const reqRef = useRef(0)

  const totalPages = Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE))

  const load = (p: number) => {
    const req = ++reqRef.current
    setLoading(true)
    fetchRef
      .current(p)
      .then(({ items: newItems, totalCount: count }) => {
        if (req !== reqRef.current) return
        setItems(newItems)
        setTotalCount(count)
      })
      .catch(() => {
        if (req === reqRef.current) toast.error(t(errorKey))
      })
      .finally(() => {
        if (req === reqRef.current) setLoading(false)
      })
  }

  useEffect(() => {
    load(0)
  }, [])

  const handlePage = (p: number) => {
    setPage(p)
    load(p)
  }

  /**
   * Takes a row out of the list once the server has removed it (resolved, unbanned,
   * deleted, ...). The page is not refetched, so the rest of it stays on screen
   * instead of flashing back to the skeleton. Functional updates, so two removals
   * in flight at once cannot put each other's row back.
   */
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    setTotalCount((count) => Math.max(0, count - 1))
  }

  // Removing the last row of a page past the first would leave the admin on an
  // empty page beyond the end of the list; step back to the page before it.
  const pageEmptied = !loading && items.length === 0 && page > 0
  useEffect(() => {
    if (pageEmptied) handlePage(page - 1)
  }, [pageEmptied, page])

  return {
    items,
    page,
    loading,
    totalPages,
    handlePage,
    removeItem,
    setItems,
  }
}

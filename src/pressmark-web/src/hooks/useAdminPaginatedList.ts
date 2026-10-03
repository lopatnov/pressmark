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
  // Ids removeItem has taken out locally but a request already in flight when it
  // ran might still carry — filtered out of whatever that request lands with, so
  // a stale response can't put a just-removed row back. Forgotten again once a
  // response confirms the row is actually gone server-side.
  const removedSinceLoadRef = useRef<Set<string>>(new Set())

  const totalPages = Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE))

  const load = (p: number, opts: { silent?: boolean; onSettled?: () => void } = {}) => {
    const req = ++reqRef.current
    if (!opts.silent) setLoading(true)
    fetchRef
      .current(p)
      .then(({ items: newItems, totalCount: count }) => {
        if (req !== reqRef.current) return
        const removedSinceLoad = removedSinceLoadRef.current
        setItems(newItems.filter((item) => !removedSinceLoad.has(item.id)))
        setTotalCount(count)
        for (const id of removedSinceLoad) {
          if (!newItems.some((item) => item.id === id)) removedSinceLoad.delete(id)
        }
      })
      .catch(() => {
        if (req === reqRef.current) toast.error(t(errorKey))
      })
      .finally(() => {
        if (req === reqRef.current && !opts.silent) setLoading(false)
        opts.onSettled?.()
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
   * deleted, ...). Updates local state only, so the rest of the page stays on
   * screen instead of flashing back to the skeleton; the reconcile effect below
   * corrects anything this leaves stale. Functional updates, so two removals in
   * flight at once cannot put each other's row back, and the id is remembered
   * until a load confirms it, so a response already in flight when this ran
   * can't put the row back either.
   */
  const removeItem = (id: string) => {
    removedSinceLoadRef.current.add(id)
    setItems((prev) => prev.filter((item) => item.id !== id))
    setTotalCount((count) => Math.max(0, count - 1))
  }

  // removeItem only filters local state, so the offsets it didn't fetch drift from
  // the server's: a row that should have slid up from the next page is missing,
  // the current page can run past the end of a shrunk list, or (removing several
  // at once) both. Reconcile with a silent background refetch of the now-current
  // page whenever this page is missing rows it should hold, or no longer exists.
  // reconcilingRef blocks a second refetch for the same transition: setPage's own
  // re-render still sees the old page's (now stale) items against the new page's
  // expected count, which would otherwise look underfilled too and fire again
  // before the first refetch has even landed.
  const reconcilingRef = useRef(false)
  const lastPage = Math.max(0, Math.ceil(totalCount / ADMIN_PAGE_SIZE) - 1)
  const expectedOnPage = Math.min(ADMIN_PAGE_SIZE, Math.max(0, totalCount - page * ADMIN_PAGE_SIZE))
  const pageOverflowed = page > lastPage
  const pageUnderfilled = !pageOverflowed && totalCount > 0 && items.length < expectedOnPage
  const needsReconcile = !loading && !reconcilingRef.current && (pageOverflowed || pageUnderfilled)
  useEffect(() => {
    if (!needsReconcile) return
    const target = Math.min(page, lastPage)
    if (target !== page) setPage(target)
    reconcilingRef.current = true
    load(target, {
      silent: true,
      onSettled: () => {
        reconcilingRef.current = false
      },
    })
  }, [needsReconcile, page, lastPage])

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

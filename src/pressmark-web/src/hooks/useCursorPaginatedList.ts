import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useIntersectionLoader } from '@/hooks/useIntersectionLoader'

interface PagedResult<TItem> {
  items: TItem[]
  nextCursor: string
}

/**
 * Shared cursor-pagination shape for list hooks (community feed, bookmarks, ...):
 * loads a page, appends on load-more and replaces on filter change, and aborts
 * the in-flight request when the filter changes again before it resolves.
 *
 * `fetchPage` owns the RPC call and the response-to-item mapping together (as a
 * single `.map()`, same as before extraction), so callers keep normal contextual
 * typing on the mapped item shape instead of threading a second generic through.
 *
 * @param fetchPage Called with (cursor, signal); resolves to a mapped page.
 * @param resetKey Reload from the first page whenever this value changes.
 * @param clearOnReset When true, the list is cleared immediately on `resetKey`
 *   change instead of staying populated until the reload resolves.
 */
export function useCursorPaginatedList<TItem>(
  fetchPage: (cursor: string, signal: AbortSignal) => Promise<PagedResult<TItem>>,
  resetKey: unknown,
  clearOnReset = false,
) {
  const { t } = useTranslation('common')
  const [items, setItems] = useState<TItem[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  // Shared across loadMore and the reset effect so either one starting a
  // fresh request aborts whichever request the other one has in flight.
  const abortRef = useRef<AbortController | null>(null)

  const loadPage = useCallback(
    async (cursor: string, signal: AbortSignal) => {
      setIsLoading(true)
      try {
        const res = await fetchPage(cursor, signal)
        if (signal.aborted) return
        setItems((prev) => (cursor ? [...prev, ...res.items] : res.items))
        setNextCursor(res.nextCursor)
      } catch {
        if (!signal.aborted) toast.error(t('common:error'))
      } finally {
        // An aborted request must not clear the flag the request that replaced
        // it has already set, or the skeleton drops and loadMore refires early.
        if (!signal.aborted) setIsLoading(false)
      }
    },
    [fetchPage, t],
  )

  const startLoad = useCallback(
    (cursor: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      loadPage(cursor, controller.signal)
    },
    [loadPage],
  )

  const loadMore = useCallback(() => {
    if (!isLoading) startLoad(nextCursor)
  }, [nextCursor, isLoading, startLoad])

  const sentinelRef = useIntersectionLoader(loadMore, !!nextCursor && !isLoading)

  useEffect(() => {
    if (clearOnReset) {
      setItems([])
      setNextCursor('')
    }
    startLoad('')
    return () => abortRef.current?.abort()
  }, [resetKey, startLoad, clearOnReset])

  return { items, setItems, nextCursor, isLoading, sentinelRef, loadMore }
}

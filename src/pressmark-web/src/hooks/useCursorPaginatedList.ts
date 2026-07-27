import { useCallback, useEffect, useState } from 'react'
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

  const loadPage = useCallback(
    async (cursor = '', signal?: AbortSignal) => {
      setIsLoading(true)
      try {
        const res = await fetchPage(cursor, signal as AbortSignal)
        if (signal?.aborted) return
        setItems((prev) => (cursor ? [...prev, ...res.items] : res.items))
        setNextCursor(res.nextCursor)
      } catch {
        if (!signal?.aborted) toast.error(t('common:error'))
      } finally {
        // An aborted request must not clear the flag the request that replaced
        // it has already set, or the skeleton drops and loadMore refires early.
        if (!signal?.aborted) setIsLoading(false)
      }
    },
    [fetchPage, t],
  )

  const loadMore = useCallback(() => {
    if (!isLoading) loadPage(nextCursor)
  }, [nextCursor, isLoading, loadPage])

  const sentinelRef = useIntersectionLoader(loadMore, !!nextCursor && !isLoading)

  useEffect(() => {
    const controller = new AbortController()
    if (clearOnReset) {
      setItems([])
      setNextCursor('')
    }
    loadPage('', controller.signal)
    return () => controller.abort()
  }, [resetKey, loadPage, clearOnReset])

  return { items, setItems, nextCursor, isLoading, sentinelRef, loadMore }
}

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export const ADMIN_PAGE_SIZE = 20

interface PageResult<T> {
  items: T[]
  totalCount: number
}

export function useAdminPaginatedList<T>(
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

  return {
    items,
    totalCount,
    page,
    loading,
    totalPages,
    handlePage,
    load,
    setItems,
    setTotalCount,
    setPage,
  }
}

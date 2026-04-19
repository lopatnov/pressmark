import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface Props {
  readonly page: number
  readonly totalPages: number
  readonly loading: boolean
  readonly onPage: (p: number) => void
}

export function AdminPagination({ page, totalPages, loading, onPage }: Props) {
  const { t } = useTranslation('admin')
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <Button
        size="sm"
        variant="outline"
        disabled={page === 0 || loading}
        onClick={() => onPage(page - 1)}
      >
        {t('pagination.prev')}
      </Button>
      <span>{t('pagination.pageOf', { page: page + 1, total: totalPages })}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={page >= totalPages - 1 || loading}
        onClick={() => onPage(page + 1)}
      >
        {t('pagination.next')}
      </Button>
    </div>
  )
}

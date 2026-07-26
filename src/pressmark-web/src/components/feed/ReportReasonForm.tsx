import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface Props {
  readonly reason: string
  readonly onReasonChange: (reason: string) => void
  readonly onSubmit: () => void
  readonly onCancel: () => void
  readonly submitting?: boolean
}

/** Free-text reason field plus send/cancel controls, shared by article and comment reporting. */
export function ReportReasonForm({
  reason,
  onReasonChange,
  onSubmit,
  onCancel,
  submitting,
}: Props) {
  const { t } = useTranslation('feed')

  return (
    <div className="flex w-full flex-col gap-2">
      <textarea
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        aria-label={t('reportReason')}
        placeholder={t('reportReason')}
        maxLength={500}
        rows={2}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs resize-none"
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onSubmit} disabled={submitting}>
          {t('reportSend')}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {t('reportCancel')}
        </Button>
      </div>
    </div>
  )
}

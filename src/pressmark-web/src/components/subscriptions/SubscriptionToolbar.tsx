import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, BellOff, Download, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  readonly digestEnabled: boolean
  readonly onToggleDigest: () => void
  readonly onExport: () => void
  readonly onImport: (file: File, onSettled: () => void) => void
  readonly onAddClick: () => void
}

export function SubscriptionToolbar({
  digestEnabled,
  onToggleDigest,
  onExport,
  onImport,
  onAddClick,
}: Props) {
  const { t } = useTranslation(['subscriptions', 'common'])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Clear the input once the import settles so the same file can be re-picked
    onImport(file, () => {
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant={digestEnabled ? 'default' : 'outline'}
        onClick={onToggleDigest}
        title={digestEnabled ? t('subscriptions:digestDisable') : t('subscriptions:digestEnable')}
      >
        {digestEnabled ? <Bell className="mr-1 h-4 w-4" /> : <BellOff className="mr-1 h-4 w-4" />}
        {t('subscriptions:digest')}
      </Button>
      <Button size="sm" variant="outline" onClick={onExport}>
        <Download className="mr-1 h-4 w-4" />
        {t('subscriptions:export')}
      </Button>
      <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
        <Upload className="mr-1 h-4 w-4" />
        {t('subscriptions:import')}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".opml,.xml"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button size="sm" onClick={onAddClick}>
        <Plus className="mr-1 h-4 w-4" />
        {t('subscriptions:add')}
      </Button>
    </div>
  )
}

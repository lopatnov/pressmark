import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useSubscriptions } from '@/hooks/useSubscriptions'
import { AddSubscriptionForm } from '@/components/subscriptions/AddSubscriptionForm'
import { SubscriptionRow } from '@/components/subscriptions/SubscriptionRow'
import { SubscriptionSkeletonList } from '@/components/subscriptions/SubscriptionSkeletonList'
import { SubscriptionToolbar } from '@/components/subscriptions/SubscriptionToolbar'

export function SubscriptionsPage() {
  const { t } = useTranslation(['subscriptions', 'common'])
  usePageTitle(t('common:nav.subscriptions'))

  const {
    subscriptions,
    digestEnabled,
    isLoading,
    importStatus,
    fetchingId,
    addSubscription,
    exportOpml,
    importOpml,
    refreshSubscription,
    renameSubscription,
    removeSubscription,
    toggleDigest,
  } = useSubscriptions()

  const [showForm, setShowForm] = useState(false)

  const handleRemove = (id: string) => {
    if (!confirm(t('subscriptions:removeConfirm'))) return
    removeSubscription(id)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('subscriptions:title')}</h1>
        <SubscriptionToolbar
          digestEnabled={digestEnabled}
          onToggleDigest={toggleDigest}
          onExport={exportOpml}
          onImport={importOpml}
          onAddClick={() => setShowForm((v) => !v)}
        />
      </div>

      {importStatus && <p className="rounded-md bg-muted px-3 py-2 text-sm">{importStatus}</p>}

      {showForm && (
        <AddSubscriptionForm
          onAdd={addSubscription}
          onDone={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading && subscriptions.length === 0 && <SubscriptionSkeletonList />}

      {!isLoading && subscriptions.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t('subscriptions:empty')}
        </p>
      )}

      <div className="space-y-2">
        {subscriptions.map((sub) => (
          <SubscriptionRow
            key={sub.id}
            subscription={sub}
            isFetching={fetchingId === sub.id}
            onRefresh={refreshSubscription}
            onRename={renameSubscription}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </div>
  )
}

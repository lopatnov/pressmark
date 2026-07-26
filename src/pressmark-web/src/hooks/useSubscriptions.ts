import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { subscriptionClient } from '@/api/clients'
import { useSubscriptionStore, type Subscription } from '@/store/subscriptionStore'

type SubscriptionMessage = Omit<Subscription, 'createdAt'> & { createdAt?: string }

function toSubscription(s: SubscriptionMessage): Subscription {
  return {
    id: s.id,
    rssUrl: s.rssUrl,
    title: s.title,
    lastFetchedAt: s.lastFetchedAt,
    createdAt: s.createdAt ?? '',
    isCommunityBanned: s.isCommunityBanned,
  }
}

/**
 * Owns every subscription server interaction and keeps the subscription store in
 * sync, so SubscriptionsPage is left with layout only.
 *
 * Mutations that the user cannot meaningfully retry surface a toast here.
 * `addSubscription` is the exception: it rethrows so the add form can attach the
 * server's message to the offending field.
 */
export function useSubscriptions() {
  const { t } = useTranslation(['subscriptions', 'common'])
  const {
    subscriptions,
    digestEnabled,
    isLoading,
    setSubscriptions,
    addSubscription: addToStore,
    removeSubscription: removeFromStore,
    updateSubscriptionTitle,
    setDigestEnabled,
    setLoading,
  } = useSubscriptionStore()

  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [fetchingId, setFetchingId] = useState<string | null>(null)

  const reloadList = async () => {
    const list = await subscriptionClient.listSubscriptions({})
    setSubscriptions(list.subscriptions.map(toSubscription))
  }

  useEffect(() => {
    setLoading(true)
    subscriptionClient
      .listSubscriptions({})
      .then((res) => {
        setSubscriptions(res.subscriptions.map(toSubscription))
        setDigestEnabled(res.digestEnabled)
      })
      .finally(() => setLoading(false))
  }, [])

  /** Rethrows so the caller can map the failure onto a form field. */
  const addSubscription = async (rssUrl: string, title: string) => {
    const sub = await subscriptionClient.addSubscription({ rssUrl, title })
    addToStore(toSubscription(sub))
  }

  const exportOpml = async () => {
    try {
      const res = await subscriptionClient.exportSubscriptions({})
      const blob = new Blob([res.opmlContent], { type: 'text/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'subscriptions.opml'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('common:error'))
    }
  }

  /** Reads the OPML file client-side, then imports and reloads the list. */
  const importOpml = (file: File, onSettled: () => void) => {
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const opmlContent = ev.target?.result as string
      try {
        const res = await subscriptionClient.importSubscriptions({ opmlContent })
        setImportStatus(
          t('subscriptions:importSuccess', {
            imported: res.imported,
            skipped: res.skipped,
          }),
        )
        await reloadList()
      } catch {
        setImportStatus(t('subscriptions:importError'))
      } finally {
        onSettled()
      }
    }
    reader.onerror = () => {
      setImportStatus(t('subscriptions:importError'))
      onSettled()
    }
    reader.readAsText(file)
  }

  const refreshSubscription = async (id: string) => {
    setFetchingId(id)
    try {
      await subscriptionClient.triggerFetch({ subscriptionId: id })
      // Reload to pick up the updated lastFetchedAt
      await reloadList()
    } catch {
      toast.error(t('common:error'))
    } finally {
      setFetchingId(null)
    }
  }

  const renameSubscription = async (id: string, displayName: string) => {
    try {
      const res = await subscriptionClient.updateSubscription({
        subscriptionId: id,
        displayName,
      })
      updateSubscriptionTitle(id, res.title)
      return true
    } catch {
      toast.error(t('common:error'))
      return false
    }
  }

  /** Optimistic: the row disappears immediately and the failure is ignored. */
  const removeSubscription = async (id: string) => {
    removeFromStore(id)
    await subscriptionClient.removeSubscription({ subscriptionId: id }).catch(() => {})
  }

  const toggleDigest = async () => {
    try {
      const res = await subscriptionClient.toggleDigestSubscription({})
      setDigestEnabled(res.enabled)
    } catch {
      toast.error(t('common:error'))
    }
  }

  return {
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
  }
}

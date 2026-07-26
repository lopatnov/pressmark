import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { adminClient } from '@/api/clients'

export interface AdminUserSubscription {
  id: string
  rssUrl: string
  title: string
  isCommunityBanned: boolean
}

export interface AdminUserComment {
  id: string
  body: string
  createdAt: string
  feedItemId: string
  feedItemTitle: string
  removedByAdmin: boolean
}

export interface AdminUserDetails {
  id: string
  email: string
  role: string
  createdAt: string
  isCommentingBanned: boolean
  isSiteBanned: boolean
  subscriptions: AdminUserSubscription[]
  comments: AdminUserComment[]
}

/**
 * Loads one user's admin profile and owns the moderation actions on it.
 *
 * Every action patches the loaded details in place rather than refetching, so
 * the page never flashes back to its loading state mid-moderation.
 */
export function useAdminUserDetails(id: string | undefined) {
  const { t } = useTranslation(['admin', 'common'])
  const [details, setDetails] = useState<AdminUserDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    adminClient
      .getUserDetails({ userId: id })
      .then((res) => {
        const u = res.user!
        setDetails({
          id: u.id,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
          isCommentingBanned: u.isCommentingBanned,
          isSiteBanned: u.isSiteBanned,
          subscriptions: res.subscriptions.map((s) => ({
            id: s.id,
            rssUrl: s.rssUrl,
            title: s.title,
            isCommunityBanned: s.isCommunityBanned,
          })),
          comments: res.comments.map((c) => ({
            id: c.id,
            body: c.body,
            createdAt: c.createdAt,
            feedItemId: c.feedItemId,
            feedItemTitle: c.feedItemTitle,
            removedByAdmin: c.removedByAdmin,
          })),
        })
      })
      .catch(() => toast.error(t('common:error')))
      .finally(() => setLoading(false))
  }, [id])

  const changeRole = async () => {
    if (!details) return
    const newRole = details.role === 'Admin' ? 'User' : 'Admin'
    try {
      await adminClient.changeUserRole({ userId: details.id, role: newRole })
      setDetails((d) => (d ? { ...d, role: newRole } : d))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('last admin')) {
        toast.error(t('admin:users.cannotDemoteLastAdmin'))
      } else {
        toast.error(t('common:error'))
      }
    }
  }

  const toggleSiteBan = async () => {
    if (!details) return
    try {
      await adminClient.sitebanUser({ userId: details.id, banned: !details.isSiteBanned })
      setDetails((d) => (d ? { ...d, isSiteBanned: !d.isSiteBanned } : d))
    } catch {
      toast.error(t('common:error'))
    }
  }

  const toggleSubscriptionBan = async (subId: string, currentlyBanned: boolean) => {
    try {
      await adminClient.banSubscription({ subscriptionId: subId, banned: !currentlyBanned })
      setDetails((d) =>
        d
          ? {
              ...d,
              subscriptions: d.subscriptions.map((s) =>
                s.id === subId ? { ...s, isCommunityBanned: !currentlyBanned } : s,
              ),
            }
          : d,
      )
    } catch {
      toast.error(t('common:error'))
    }
  }

  const removeComment = async (commentId: string) => {
    try {
      await adminClient.removeComment({ commentId })
      setDetails((d) =>
        d
          ? {
              ...d,
              comments: d.comments.map((c) =>
                c.id === commentId ? { ...c, removedByAdmin: true } : c,
              ),
            }
          : d,
      )
    } catch {
      toast.error(t('common:error'))
    }
  }

  /** Resolves true when the user is gone, so the caller can navigate away. */
  const deleteUser = async () => {
    if (!details) return false
    try {
      await adminClient.deleteUser({ userId: details.id })
      toast.success(t('admin:users.deleted'))
      return true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('last admin')) {
        toast.error(t('admin:users.cannotDeleteLastAdmin'))
      } else if (msg.includes('own account')) {
        toast.error(t('admin:users.cannotDeleteSelf'))
      } else {
        toast.error(t('common:error'))
      }
      return false
    }
  }

  return {
    details,
    loading,
    changeRole,
    toggleSiteBan,
    toggleSubscriptionBan,
    removeComment,
    deleteUser,
  }
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Code, ConnectError } from '@connectrpc/connect'
import { adminClient } from '@/api/clients'
import { useAuthStore } from '@/store/authStore'

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
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [details, setDetails] = useState<AdminUserDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    // Navigating between users must not let a slow response for the previous id
    // land on top of the current one.
    let cancelled = false
    setLoading(true)
    adminClient
      .getUserDetails({ userId: id })
      .then((res) => {
        if (cancelled) return
        const u = res.user
        // `user` is an optional message field: a response without it means the
        // id does not resolve, which the page renders as "user not found".
        if (!u) {
          setDetails(null)
          return
        }
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
      .catch(() => {
        if (!cancelled) toast.error(t('common:error'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, t])

  const changeRole = async () => {
    if (!details) return
    const newRole = details.role === 'Admin' ? 'User' : 'Admin'
    try {
      await adminClient.changeUserRole({ userId: details.id, role: newRole })
      setDetails((d) => (d ? { ...d, role: newRole } : d))
    } catch (err: unknown) {
      // The role change has exactly one precondition — demoting the last admin —
      // so the status code alone identifies it, no message matching needed.
      if (err instanceof ConnectError && err.code === Code.FailedPrecondition) {
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
      // Deletion has two preconditions, both reported as FailedPrecondition:
      // deleting yourself and deleting the last admin. Which one applies is
      // decided from the signed-in user's id rather than the server's wording.
      if (err instanceof ConnectError && err.code === Code.FailedPrecondition) {
        const isSelf = !!currentUserId && currentUserId === details.id
        toast.error(
          isSelf ? t('admin:users.cannotDeleteSelf') : t('admin:users.cannotDeleteLastAdmin'),
        )
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

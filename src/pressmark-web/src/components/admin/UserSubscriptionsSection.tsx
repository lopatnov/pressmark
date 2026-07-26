import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { AdminUserSubscription } from '@/hooks/useAdminUserDetails'

interface Props {
  readonly subscriptions: readonly AdminUserSubscription[]
  readonly onToggleBan: (subId: string, currentlyBanned: boolean) => void
}

export function UserSubscriptionsSection({ subscriptions, onToggleBan }: Props) {
  const { t } = useTranslation(['admin', 'common'])

  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{t('admin:users.subscriptions')}</h2>
      {subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin:users.noSubscriptions')}</p>
      ) : (
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{sub.title || sub.rssUrl}</span>
                      {sub.isCommunityBanned && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                          {t('admin:bannedSubs.banned')}
                        </span>
                      )}
                    </div>
                    {sub.title && (
                      <p className="text-xs text-muted-foreground truncate max-w-sm">
                        {sub.rssUrl}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      size="sm"
                      variant={sub.isCommunityBanned ? 'outline' : 'destructive'}
                      onClick={() => onToggleBan(sub.id, sub.isCommunityBanned)}
                    >
                      {sub.isCommunityBanned
                        ? t('admin:moderation.unban')
                        : t('admin:moderation.ban')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

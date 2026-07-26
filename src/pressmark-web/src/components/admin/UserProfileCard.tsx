import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { AdminUserDetails } from '@/hooks/useAdminUserDetails'

interface Props {
  readonly details: AdminUserDetails
  readonly onChangeRole: () => void
  readonly onToggleSiteBan: () => void
  readonly onDelete: () => void
}

export function UserProfileCard({ details, onChangeRole, onToggleSiteBan, onDelete }: Props) {
  const { t } = useTranslation(['admin', 'common'])

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-medium">{details.email}</p>
          <p className="text-xs text-muted-foreground">
            {t('admin:users.joined')}:{' '}
            {details.createdAt ? new Date(details.createdAt).toLocaleDateString() : '—'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${details.role === 'Admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
          >
            {details.role}
          </span>
          {details.isCommentingBanned && (
            <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-xs font-medium text-orange-600">
              {t('admin:users.commentBanned')}
            </span>
          )}
          {details.isSiteBanned && (
            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
              {t('admin:users.siteBanned')}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <Button size="sm" variant="outline" onClick={onChangeRole}>
          {details.role === 'Admin'
            ? t('admin:users.demoteToUser')
            : t('admin:users.promoteToAdmin')}
        </Button>
        <Button
          size="sm"
          variant={details.isSiteBanned ? 'destructive' : 'outline'}
          onClick={onToggleSiteBan}
        >
          {details.isSiteBanned ? t('admin:users.unsiteBan') : t('admin:users.siteBan')}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive">
              {t('admin:users.deleteUser')}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('admin:users.confirmDeleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('admin:users.confirmDeleteDesc', { email: details.email })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>{t('common:delete')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

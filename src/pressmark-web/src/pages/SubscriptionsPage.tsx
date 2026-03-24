import { useTranslation } from 'react-i18next'

export function SubscriptionsPage() {
  const { t } = useTranslation('subscriptions')
  return <div className="p-4"><h1 className="text-2xl font-semibold">{t('title')}</h1></div>
}

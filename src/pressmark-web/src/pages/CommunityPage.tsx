import { useTranslation } from 'react-i18next'

export function CommunityPage() {
  const { t } = useTranslation('feed')
  return <div className="p-4"><h1 className="text-2xl font-semibold">{t('community.title')}</h1></div>
}

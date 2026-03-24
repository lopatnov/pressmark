import { useTranslation } from 'react-i18next'

export function BookmarksPage() {
  const { t } = useTranslation('common')
  return <div className="p-4"><h1 className="text-2xl font-semibold">{t('nav.bookmarks')}</h1></div>
}

import DOMPurify from 'dompurify'
import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

export interface FeedItemData {
  id: string
  title: string
  url: string
  summary: string
  publishedAt: string
  sourceTitle: string
  imageUrl?: string
  isRead?: boolean
  subscriptionId?: string
  sourceRssUrl?: string
}

interface FeedItemCardProps {
  item: FeedItemData
  onTitleClick?: () => void
  actions?: React.ReactNode
  footer?: React.ReactNode
  articleId?: string
}

function sanitizeSummary(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'p', 'ul', 'ol', 'li', 'br', 'code', 'pre'],
    ALLOWED_ATTR: ['href'],
  }) as string
}

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
      if (u.pathname.startsWith('/shorts/')) return u.pathname.slice(8) || null
      return u.searchParams.get('v')
    }
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1) || null
    }
  } catch {
    // invalid URL
  }
  return null
}

function getFaviconUrl(url: string): string | null {
  try {
    return new URL(url).origin + '/favicon.ico'
  } catch {
    return null
  }
}

export function FeedItemCard({
  item,
  onTitleClick,
  actions,
  footer,
  articleId,
}: FeedItemCardProps) {
  const isUnread = item.isRead === false
  const youtubeId = getYouTubeId(item.url)
  const faviconUrl = getFaviconUrl(item.url)

  return (
    <article
      className={`rounded-lg border bg-card p-4 space-y-1.5 ${
        isUnread ? 'border-l-2 border-l-primary border-border' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onTitleClick}
          className={`text-sm font-medium leading-snug hover:underline ${
            isUnread ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {item.title}
        </a>
        {articleId ? (
          <Link
            to={`/article/${articleId}`}
            title="Open article page"
            aria-label="Open article page"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="mt-0.5 h-3.5 w-3.5" />
          </Link>
        ) : (
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {item.sourceTitle && (
          <>
            {faviconUrl && (
              <img
                src={faviconUrl}
                alt=""
                aria-hidden="true"
                className="h-3.5 w-3.5 rounded-sm object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
            <span className="font-medium">{item.sourceTitle}</span>
            <span>·</span>
          </>
        )}
        <span>
          {item.publishedAt
            ? new Date(item.publishedAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''}
        </span>
      </div>

      {item.summary && (
        <div
          className="max-h-16 overflow-hidden text-xs text-muted-foreground [&_a]:underline [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
          dangerouslySetInnerHTML={{ __html: sanitizeSummary(item.summary) }}
        />
      )}

      {youtubeId ? (
        <div className="aspect-video overflow-hidden rounded-md">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
            className="h-full w-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={item.title}
            loading="lazy"
          />
        </div>
      ) : item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          aria-hidden="true"
          className="max-h-48 w-full rounded-md object-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : null}

      {actions && <div className="flex items-center gap-1 pt-1">{actions}</div>}
      {footer}
    </article>
  )
}

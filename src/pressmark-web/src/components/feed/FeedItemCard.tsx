import { ExternalLink } from "lucide-react";
import { stripHtml } from "@/lib/utils";

export interface FeedItemData {
  id: string;
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  sourceTitle: string;
  imageUrl?: string;
  isRead?: boolean;
}

interface FeedItemCardProps {
  item: FeedItemData;
  onTitleClick?: () => void;
  actions?: React.ReactNode;
}

export function FeedItemCard({
  item,
  onTitleClick,
  actions,
}: FeedItemCardProps) {
  const isUnread = item.isRead === false;

  return (
    <article
      className={`rounded-lg border bg-card p-4 space-y-1.5 ${
        isUnread ? "border-l-2 border-l-primary border-border" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onTitleClick}
          className={`text-sm font-medium leading-snug hover:underline ${
            isUnread ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {item.title}
        </a>
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {item.sourceTitle && (
          <span className="font-medium">{item.sourceTitle}</span>
        )}
        {item.sourceTitle && <span>·</span>}
        <span>
          {item.publishedAt
            ? new Date(item.publishedAt).toLocaleDateString()
            : ""}
        </span>
      </div>

      {item.summary && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {stripHtml(item.summary)}
        </p>
      )}

      {actions && <div className="flex items-center gap-1 pt-1">{actions}</div>}
    </article>
  );
}

import type { ReactNode } from 'react'
import { AdminSkeletonRows } from './AdminSkeletonRows'

interface Props {
  readonly loading: boolean
  readonly isEmpty: boolean
  readonly emptyMessage: string
  /** One placeholder row, repeated while the list loads. */
  readonly skeletonRow: (key: string) => ReactNode
  /** The loaded list, typically a table. */
  readonly children: ReactNode
}

/**
 * Bordered body shared by the admin list sections: the skeleton while a page loads,
 * the empty message when there is nothing to show, otherwise the list itself.
 * Scrolls sideways rather than overflowing the page when a table is wider than it.
 */
export function AdminListPanel({ loading, isEmpty, emptyMessage, skeletonRow, children }: Props) {
  let content: ReactNode = children
  if (loading) {
    content = <AdminSkeletonRows>{skeletonRow}</AdminSkeletonRows>
  } else if (isEmpty) {
    content = <p className="px-4 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return <div className="overflow-x-auto rounded-lg border border-border">{content}</div>
}

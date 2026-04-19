import { type ReactNode } from 'react'

const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3'] as const

interface Props {
  readonly children: (key: string) => ReactNode
}

export function AdminSkeletonRows({ children }: Props) {
  return <div className="divide-y divide-border">{SKELETON_KEYS.map(children)}</div>
}

import { useState, useCallback, type ReactNode } from 'react'
import { useIntersectionLoader } from '@/hooks/useIntersectionLoader'

interface LazyVisibleSectionProps {
  children: ReactNode
  fallback?: ReactNode
}

export default function LazyVisibleSection({ children, fallback }: LazyVisibleSectionProps) {
  const [isVisible, setIsVisible] = useState(false)
  const onIntersect = useCallback(() => setIsVisible(true), [])
  const ref = useIntersectionLoader(onIntersect, !isVisible)

  // If not yet visible, render a placeholder with a sentinel
  if (!isVisible) {
    return (
      <div ref={ref} className="min-h-[100px] w-full" aria-hidden="true">
        {fallback || <div className="h-20" />}
      </div>
    )
  }

  // Once visible, render the actual content
  return <>{children}</>
}

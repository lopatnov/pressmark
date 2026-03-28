import { useEffect, useRef } from 'react'

/**
 * Attaches an IntersectionObserver to a sentinel element.
 * Calls `onIntersect` when the element enters the viewport.
 * Does nothing when `enabled` is false (no cursor, already loading, etc.).
 */
export function useIntersectionLoader(onIntersect: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!enabled || !ref.current) return
    const el = ref.current
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onIntersect()
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled, onIntersect])

  return ref
}

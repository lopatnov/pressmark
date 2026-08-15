import { useCallback, useRef } from 'react'

/**
 * Keeps at most one request in flight for a single concern: starting a new one
 * aborts whichever is still running and hands the caller the new request's
 * signal, so a superseded response can be dropped instead of landing on top of
 * the state its replacement has already written.
 *
 * A loader that can be re-triggered from two places at once — a filter change
 * and a load-more, say — needs one controller shared by both. Giving each path
 * its own (or leaving one path unabortable) lets a late response from the path
 * that was not aborted append to, and repaginate, the list that replaced it.
 */
export function useLatestRequest() {
  const abortRef = useRef<AbortController | null>(null)

  /** Aborts the request in flight, then invokes `run` with a fresh signal. */
  const start = useCallback((run: (signal: AbortSignal) => void) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    run(controller.signal)
  }, [])

  /** Aborts the request in flight, if any. Safe to return as an effect cleanup. */
  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { start, abort }
}

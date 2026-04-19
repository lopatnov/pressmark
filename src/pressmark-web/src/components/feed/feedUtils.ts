import DOMPurify from 'dompurify'

export function sanitizeSummary(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['a', 'b', 'i', 'em', 'strong', 'p', 'ul', 'ol', 'li', 'br', 'code', 'pre'],
    ALLOWED_ATTR: ['href'],
  }) as string
}

export function getYouTubeId(url: string): string | null {
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

export function getFaviconUrl(url: string): string | null {
  try {
    const origin = new URL(url).origin
    return `/proxy/favicon?url=${encodeURIComponent(origin)}`
  } catch {
    return null
  }
}

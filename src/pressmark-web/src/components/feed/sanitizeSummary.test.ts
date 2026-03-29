import { describe, it, expect } from 'vitest'
import { sanitizeSummary } from './feedUtils'

describe('sanitizeSummary XSS protection', () => {
  it('strips script tags entirely', () => {
    const result = sanitizeSummary('<p>text</p><script>alert(1)</script>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert(1)')
    expect(result).toContain('text')
  })

  it('strips javascript: href to prevent XSS via anchor', () => {
    const result = sanitizeSummary('<a href="javascript:alert(1)">click</a>')
    // DOMPurify removes javascript: href — either the href is gone or the tag is stripped
    expect(result).not.toContain('javascript:')
  })

  it('preserves safe anchor tags with https href', () => {
    const result = sanitizeSummary('<a href="https://example.com">link</a>')
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('link')
  })

  it('preserves allowed formatting tags', () => {
    const html = '<b>bold</b><i>italic</i><strong>strong</strong><em>em</em>'
    const result = sanitizeSummary(html)
    expect(result).toContain('<b>bold</b>')
    expect(result).toContain('<i>italic</i>')
    expect(result).toContain('<strong>strong</strong>')
    expect(result).toContain('<em>em</em>')
  })

  it('strips disallowed tags but keeps their text content', () => {
    const result = sanitizeSummary('<div>content</div>')
    expect(result).not.toContain('<div>')
    expect(result).toContain('content')
  })

  it('strips img tags (not in allowlist)', () => {
    const result = sanitizeSummary('<img src="x" onerror="alert(1)">')
    expect(result).not.toContain('<img')
    expect(result).not.toContain('onerror')
  })

  it('strips event handler attributes', () => {
    const result = sanitizeSummary('<b onclick="alert(1)">text</b>')
    expect(result).not.toContain('onclick')
    expect(result).toContain('text')
  })
})

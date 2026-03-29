import { describe, it, expect } from 'vitest'
import { getYouTubeId } from './feedUtils'

describe('getYouTubeId', () => {
  it('extracts video id from standard youtube.com/watch URL', () => {
    expect(getYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts video id without www prefix', () => {
    expect(getYouTubeId('https://youtube.com/watch?v=abc123')).toBe('abc123')
  })

  it('extracts video id from youtu.be short URL', () => {
    expect(getYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts video id from YouTube Shorts URL', () => {
    expect(getYouTubeId('https://www.youtube.com/shorts/abc123XYZ')).toBe('abc123XYZ')
  })

  it('returns null for non-YouTube URL', () => {
    expect(getYouTubeId('https://example.com/video?v=foo')).toBeNull()
  })

  it('returns null for invalid URL string', () => {
    expect(getYouTubeId('not-a-url')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getYouTubeId('')).toBeNull()
  })

  it('returns null for youtube.com URL without v param', () => {
    expect(getYouTubeId('https://www.youtube.com/channel/UCxxx')).toBeNull()
  })

  it('returns null for youtu.be URL with empty path', () => {
    expect(getYouTubeId('https://youtu.be/')).toBeNull()
  })
})

// Source platform detection from URL

export const SOURCE_PATTERNS = [
  {
    key: 'facebook',
    label: 'Facebook',
    patterns: ['facebook.com', 'fb.com', 'fb.me'],
  },
  {
    key: 'instagram',
    label: 'Instagram',
    patterns: ['instagram.com', 'instagr.am'],
  },
  { key: 'tiktok', label: 'TikTok', patterns: ['tiktok.com', 'vm.tiktok.com'] },
  { key: 'youtube', label: 'YouTube', patterns: ['youtube.com', 'youtu.be'] },
  {
    key: 'twitter',
    label: 'X / Twitter',
    patterns: ['twitter.com', 'x.com', 't.co'],
  },
  { key: 'linkedin', label: 'LinkedIn', patterns: ['linkedin.com'] },
  {
    key: 'pinterest',
    label: 'Pinterest',
    patterns: ['pinterest.com', 'pin.it'],
  },
  { key: 'snapchat', label: 'Snapchat', patterns: ['snapchat.com'] },
] as const

export type SourcePlatform = (typeof SOURCE_PATTERNS)[number]['key'] | 'other'

export function detectSourceFromUrl(url: string): SourcePlatform {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    for (const source of SOURCE_PATTERNS) {
      if (source.patterns.some((pattern) => hostname.includes(pattern))) {
        return source.key
      }
    }
  } catch {
    // Invalid URL
  }
  return 'other'
}

export function getSourceLabel(key: SourcePlatform): string {
  const source = SOURCE_PATTERNS.find((s) => s.key === key)
  return source?.label || 'Other'
}

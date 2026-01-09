import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// Source platforms (allows custom sources beyond defaults)
export const sources = pgTable(
  'sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id'), // null for global/default sources
    key: text('key').notNull(), // e.g. 'facebook', 'instagram', 'tiktok'
    label: text('label').notNull(), // Display name e.g. 'Facebook', 'Instagram'
    domainPatterns: text('domain_patterns').array(), // e.g. ['facebook.com', 'fb.com']
    iconUrl: text('icon_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('sources_owner_idx').on(table.ownerId),
    uniqueIndex('sources_owner_key_idx').on(table.ownerId, table.key),
  ],
)

// Default source platforms
export const DEFAULT_SOURCES = [
  {
    key: 'facebook',
    label: 'Facebook',
    domainPatterns: ['facebook.com', 'fb.com', 'fb.me'],
  },
  {
    key: 'instagram',
    label: 'Instagram',
    domainPatterns: ['instagram.com', 'instagr.am'],
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    domainPatterns: ['tiktok.com', 'vm.tiktok.com'],
  },
  {
    key: 'youtube',
    label: 'YouTube',
    domainPatterns: ['youtube.com', 'youtu.be'],
  },
  {
    key: 'twitter',
    label: 'X / Twitter',
    domainPatterns: ['twitter.com', 'x.com', 't.co'],
  },
  { key: 'linkedin', label: 'LinkedIn', domainPatterns: ['linkedin.com'] },
  {
    key: 'pinterest',
    label: 'Pinterest',
    domainPatterns: ['pinterest.com', 'pin.it'],
  },
  { key: 'snapchat', label: 'Snapchat', domainPatterns: ['snapchat.com'] },
  { key: 'other', label: 'Other', domainPatterns: [] },
] as const

/**
 * Detect source platform from a URL
 */
export function detectSourceFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    for (const source of DEFAULT_SOURCES) {
      if (source.domainPatterns.some((pattern) => hostname.includes(pattern))) {
        return source.key
      }
    }
  } catch {
    // Invalid URL
  }
  return 'other'
}

// Types
export type Source = typeof sources.$inferSelect
export type NewSource = typeof sources.$inferInsert

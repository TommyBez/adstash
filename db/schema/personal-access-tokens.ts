import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Personal Access Tokens for extension authentication
export const personalAccessTokens = pgTable(
  'personal_access_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull(),
    name: text('name').notNull(), // User-friendly name e.g. "Chrome Extension"
    tokenHash: text('token_hash').notNull(), // SHA-256 hash of the token
    tokenPrefix: text('token_prefix').notNull(), // First 8 chars for identification
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [
    index('pat_owner_idx').on(table.ownerId),
    index('pat_token_hash_idx').on(table.tokenHash),
    index('pat_prefix_idx').on(table.tokenPrefix),
  ],
)

// Types
export type PersonalAccessToken = typeof personalAccessTokens.$inferSelect
export type NewPersonalAccessToken = typeof personalAccessTokens.$inferInsert

/**
 * Generate a new PAT (to be shown to user once, then stored hashed)
 */
export function generatePAT(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const tokenLength = 40
  let token = 'adstash_'
  for (let i = 0; i < tokenLength; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

/**
 * Hash a PAT for storage (using Web Crypto API)
 */
export async function hashPAT(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Get the prefix of a PAT for identification
 */
export function getPATPrefix(token: string): string {
  return token.slice(0, 16) // "adstash_" + 8 chars
}

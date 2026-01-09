import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { assets, assetTags } from './schema/assets'
import { personalAccessTokens } from './schema/personal-access-tokens'
import { sources } from './schema/sources'
import { tags } from './schema/tags'

// Connection for queries (with connection pooling)
const connectionString = process.env.POSTGRES_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, {
  schema: {
    assets,
    assetTags,
    personalAccessTokens,
    sources,
    tags,
  },
})

export type Database = typeof db

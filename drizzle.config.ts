import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: [
    './db/schema/assets.ts',
    './db/schema/personal-access-tokens.ts',
    './db/schema/sources.ts',
    './db/schema/tags.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
  verbose: true,
  strict: true,
})

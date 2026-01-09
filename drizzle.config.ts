import dotenv from 'dotenv'
import { defineConfig } from 'drizzle-kit'

dotenv.config()

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not set')
}

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
    url: process.env.POSTGRES_URL,
  },
  verbose: true,
  strict: true,
})

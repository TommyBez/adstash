import { relations } from 'drizzle-orm'
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { assetTags } from './assets'

// Tags table
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6b7280'), // Default gray
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('tags_owner_idx').on(table.ownerId),
    uniqueIndex('tags_owner_name_idx').on(table.ownerId, table.name),
  ],
)

// Relations
export const tagsRelations = relations(tags, ({ many }) => ({
  assetTags: many(assetTags),
}))

// Update assetTags relations to include tag
export const assetTagsTagRelations = relations(assetTags, ({ one }) => ({
  tag: one(tags, {
    fields: [assetTags.tagId],
    references: [tags.id],
  }),
}))

// Types
export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

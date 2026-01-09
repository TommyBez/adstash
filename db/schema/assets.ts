import { relations } from 'drizzle-orm'
import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// Enums
export const captureMethodEnum = pgEnum('capture_method', [
  'web_upload',
  'extension_capture',
])

export const assetStatusEnum = pgEnum('asset_status', [
  'draft',
  'uploading',
  'ready',
  'failed',
])

// Assets table
export const assets = pgTable(
  'assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Status
    status: assetStatusEnum('status').notNull().default('draft'),

    // Capture info
    captureMethod: captureMethodEnum('capture_method').notNull(),
    sourcePlatform: text('source_platform').notNull().default('other'),
    captureUrl: text('capture_url'),
    mediaUrl: text('media_url'), // Original media URL (for fallback captures)

    // File info
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),

    // Dimensions (for images/videos)
    width: integer('width'),
    height: integer('height'),
    durationSeconds: numeric('duration_seconds'),

    // Storage paths
    storageBucket: text('storage_bucket').notNull(),
    storagePath: text('storage_path').notNull(),
    previewBucket: text('preview_bucket'),
    previewPath: text('preview_path'),

    // Metadata
    sha256: text('sha256'),
    notes: text('notes'),
    extra: jsonb('extra').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('assets_owner_created_idx').on(table.ownerId, table.createdAt),
    index('assets_owner_source_idx').on(table.ownerId, table.sourcePlatform),
    index('assets_owner_mime_idx').on(table.ownerId, table.mimeType),
    index('assets_owner_status_idx').on(table.ownerId, table.status),
    index('assets_sha256_idx').on(table.sha256),
  ],
)

// Asset-Tags junction table
export const assetTags = pgTable(
  'asset_tags',
  {
    assetId: uuid('asset_id')
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id').notNull(),
  },
  (table) => [
    index('asset_tags_asset_idx').on(table.assetId),
    index('asset_tags_tag_idx').on(table.tagId),
  ],
)

// Relations
export const assetsRelations = relations(assets, ({ many }) => ({
  assetTags: many(assetTags),
}))

export const assetTagsRelations = relations(assetTags, ({ one }) => ({
  asset: one(assets, {
    fields: [assetTags.assetId],
    references: [assets.id],
  }),
}))

// Types
export type Asset = typeof assets.$inferSelect
export type NewAsset = typeof assets.$inferInsert
export type AssetTag = typeof assetTags.$inferSelect
export type NewAssetTag = typeof assetTags.$inferInsert

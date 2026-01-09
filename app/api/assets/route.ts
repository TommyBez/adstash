import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assets, assetTags } from '@/db/schema/assets'
import { tags } from '@/db/schema/tags'
import { createClient } from '@/lib/supabase/server'
import { createSignedDownloadUrl } from '@/lib/supabase/storage'

interface QueryParams {
  page: number
  limit: number
  search: string
  sourcePlatform: string
  mimeTypeFilter: string
  tagIds: string[]
  fromDate: string
  toDate: string
}

function parseQueryParams(searchParams: URLSearchParams): QueryParams {
  return {
    page: Number.parseInt(searchParams.get('page') || '1', 10),
    limit: Math.min(
      Number.parseInt(searchParams.get('limit') || '24', 10),
      100,
    ),
    search: searchParams.get('search') || '',
    sourcePlatform: searchParams.get('source') || '',
    mimeTypeFilter: searchParams.get('type') || '',
    tagIds: searchParams.get('tags')?.split(',').filter(Boolean) || [],
    fromDate: searchParams.get('from') || '',
    toDate: searchParams.get('to') || '',
  }
}

function buildWhereConditions(
  userId: string,
  params: QueryParams,
): ReturnType<typeof and>[] {
  const conditions: ReturnType<typeof and>[] = [
    eq(assets.ownerId, userId),
    eq(assets.status, 'ready'),
  ]

  if (params.search) {
    const searchCondition = or(
      ilike(assets.originalFilename, `%${params.search}%`),
      ilike(assets.notes, `%${params.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (params.sourcePlatform) {
    conditions.push(eq(assets.sourcePlatform, params.sourcePlatform))
  }

  if (params.mimeTypeFilter === 'image') {
    conditions.push(ilike(assets.mimeType, 'image/%'))
  } else if (params.mimeTypeFilter === 'video') {
    conditions.push(ilike(assets.mimeType, 'video/%'))
  }

  if (params.fromDate) {
    conditions.push(gte(assets.createdAt, new Date(params.fromDate)))
  }

  if (params.toDate) {
    conditions.push(lte(assets.createdAt, new Date(params.toDate)))
  }

  return conditions
}

async function getAssetsWithTags(assetIds: string[]) {
  if (assetIds.length === 0) {
    return new Map<string, (typeof tags.$inferSelect)[]>()
  }

  const assetTagsData = await db
    .select({
      assetId: assetTags.assetId,
      tag: tags,
    })
    .from(assetTags)
    .innerJoin(tags, eq(assetTags.tagId, tags.id))
    .where(inArray(assetTags.assetId, assetIds))

  const tagsByAsset = new Map<string, (typeof tags.$inferSelect)[]>()
  for (const row of assetTagsData) {
    const existing = tagsByAsset.get(row.assetId) || []
    existing.push(row.tag)
    tagsByAsset.set(row.assetId, existing)
  }

  return tagsByAsset
}

function addPreviewUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assetResults: (typeof assets.$inferSelect)[],
  tagsByAsset: Map<string, (typeof tags.$inferSelect)[]>,
) {
  return Promise.all(
    assetResults.map(async (asset) => {
      let previewUrl: string | null = null
      try {
        if (asset.previewBucket && asset.previewPath) {
          const urlData = await createSignedDownloadUrl(supabase, {
            bucket: asset.previewBucket,
            path: asset.previewPath,
            expiresIn: 3600,
          })
          previewUrl = urlData.signedUrl
        }
      } catch {
        // Preview not available
      }

      return {
        ...asset,
        previewUrl,
        tags: tagsByAsset.get(asset.id) || [],
      }
    }),
  )
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const params = parseQueryParams(searchParams)
    const offset = (params.page - 1) * params.limit

    const conditions = buildWhereConditions(user.id, params)

    // Build asset query
    let assetQuery = db
      .select()
      .from(assets)
      .where(and(...conditions))
      .orderBy(desc(assets.createdAt))
      .limit(params.limit)
      .offset(offset)

    if (params.tagIds.length > 0) {
      const assetsWithTags = db
        .select({ assetId: assetTags.assetId })
        .from(assetTags)
        .where(inArray(assetTags.tagId, params.tagIds))
        .groupBy(assetTags.assetId)
        .having(
          sql`count(distinct ${assetTags.tagId}) = ${params.tagIds.length}`,
        )

      assetQuery = db
        .select()
        .from(assets)
        .where(and(...conditions, inArray(assets.id, assetsWithTags)))
        .orderBy(desc(assets.createdAt))
        .limit(params.limit)
        .offset(offset)
    }

    const [assetResults, countResult] = await Promise.all([
      assetQuery,
      db
        .select({ count: count() })
        .from(assets)
        .where(and(...conditions)),
    ])

    const assetIds = assetResults.map((a) => a.id)
    const tagsByAsset = await getAssetsWithTags(assetIds)
    const assetsWithUrls = await addPreviewUrls(
      supabase,
      assetResults,
      tagsByAsset,
    )

    const totalCount = countResult[0]?.count || 0
    const totalPages = Math.ceil(totalCount / params.limit)

    return NextResponse.json({
      assets: assetsWithUrls,
      pagination: {
        page: params.page,
        limit: params.limit,
        totalCount,
        totalPages,
        hasMore: params.page < totalPages,
      },
    })
  } catch (error) {
    console.error('Get assets error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 },
    )
  }
}

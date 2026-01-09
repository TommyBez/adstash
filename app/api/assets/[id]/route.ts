import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assets, assetTags } from '@/db/schema/assets'
import { tags } from '@/db/schema/tags'
import { createClient } from '@/lib/supabase/server'
import { createSignedDownloadUrl, deleteFile } from '@/lib/supabase/storage'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.ownerId, user.id)))

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Get tags
    const assetTagsData = await db
      .select({ tag: tags })
      .from(assetTags)
      .innerJoin(tags, eq(assetTags.tagId, tags.id))
      .where(eq(assetTags.assetId, id))

    // Generate signed URLs
    let assetUrl: string | null = null
    let previewUrl: string | null = null

    try {
      const urlData = await createSignedDownloadUrl(supabase, {
        bucket: asset.storageBucket,
        path: asset.storagePath,
        expiresIn: 3600,
      })
      assetUrl = urlData.signedUrl
    } catch {
      // Asset file not found
    }

    if (asset.previewBucket && asset.previewPath) {
      try {
        const urlData = await createSignedDownloadUrl(supabase, {
          bucket: asset.previewBucket,
          path: asset.previewPath,
          expiresIn: 3600,
        })
        previewUrl = urlData.signedUrl
      } catch {
        // Preview not found
      }
    }

    return NextResponse.json({
      asset: {
        ...asset,
        assetUrl,
        previewUrl,
        tags: assetTagsData.map((row) => row.tag),
      },
    })
  } catch (error) {
    console.error('Get asset error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch asset' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { notes, sourcePlatform, tagIds } = body

    // Update asset
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (notes !== undefined) {
      updateData.notes = notes
    }
    if (sourcePlatform) {
      updateData.sourcePlatform = sourcePlatform
    }

    const [updatedAsset] = await db
      .update(assets)
      .set(updateData)
      .where(and(eq(assets.id, id), eq(assets.ownerId, user.id)))
      .returning()

    if (!updatedAsset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Update tags if provided
    if (Array.isArray(tagIds)) {
      // Remove existing tags
      await db.delete(assetTags).where(eq(assetTags.assetId, id))

      // Add new tags
      if (tagIds.length > 0) {
        await db.insert(assetTags).values(
          tagIds.map((tagId: string) => ({
            assetId: id,
            tagId,
          })),
        )
      }
    }

    return NextResponse.json({ asset: updatedAsset })
  } catch (error) {
    console.error('Update asset error:', error)
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get asset to find storage paths
    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.ownerId, user.id)))

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Delete files from storage
    try {
      await deleteFile(supabase, asset.storageBucket, asset.storagePath)
    } catch {
      console.warn('Failed to delete asset file')
    }

    if (asset.previewBucket && asset.previewPath) {
      try {
        await deleteFile(supabase, asset.previewBucket, asset.previewPath)
      } catch {
        console.warn('Failed to delete preview file')
      }
    }

    // Delete asset tags
    await db.delete(assetTags).where(eq(assetTags.assetId, id))

    // Delete asset
    await db.delete(assets).where(eq(assets.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete asset error:', error)
    return NextResponse.json(
      { error: 'Failed to delete asset' },
      { status: 500 },
    )
  }
}

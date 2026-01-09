import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assets } from '@/db/schema/assets'
import { createClient } from '@/lib/supabase/server'

interface FinalizeUploadRequest {
  assetId: string
  width?: number
  height?: number
  durationSeconds?: number
  sha256?: string
  sizeBytes?: number
  notes?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: FinalizeUploadRequest = await request.json()
    const {
      assetId,
      width,
      height,
      durationSeconds,
      sha256,
      sizeBytes,
      notes,
    } = body

    if (!assetId) {
      return NextResponse.json({ error: 'Missing assetId' }, { status: 400 })
    }

    // Update asset to ready status with metadata
    const [updatedAsset] = await db
      .update(assets)
      .set({
        status: 'ready',
        width: width || null,
        height: height || null,
        durationSeconds: durationSeconds?.toString() || null,
        sha256: sha256 || null,
        sizeBytes: sizeBytes || null,
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(and(eq(assets.id, assetId), eq(assets.ownerId, user.id)))
      .returning()

    if (!updatedAsset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    return NextResponse.json({ asset: updatedAsset })
  } catch (error) {
    console.error('Finalize upload error:', error)
    return NextResponse.json(
      { error: 'Failed to finalize upload' },
      { status: 500 },
    )
  }
}

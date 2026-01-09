import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assets } from '@/db/schema/assets'
import { detectSourceFromUrl } from '@/db/schema/sources'
import { createClient } from '@/lib/supabase/server'
import {
  ASSETS_BUCKET,
  createSignedUploadUrl,
  generateAssetPath,
  PREVIEWS_BUCKET,
} from '@/lib/supabase/storage'

interface InitUploadRequest {
  filename: string
  mimeType: string
  sizeBytes?: number
  sourcePlatform?: string
  captureUrl?: string
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

    const body: InitUploadRequest = await request.json()
    const { filename, mimeType, sizeBytes, sourcePlatform, captureUrl } = body

    if (!(filename && mimeType)) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, mimeType' },
        { status: 400 },
      )
    }

    // Generate storage paths
    const storagePath = generateAssetPath(user.id, filename)
    const previewPath = generateAssetPath(
      user.id,
      `preview-${filename}`,
      'previews',
    )

    // Create asset record in draft status
    const [asset] = await db
      .insert(assets)
      .values({
        ownerId: user.id,
        status: 'uploading',
        captureMethod: 'web_upload',
        sourcePlatform:
          sourcePlatform ||
          (captureUrl ? detectSourceFromUrl(captureUrl) : 'other'),
        captureUrl: captureUrl || null,
        originalFilename: filename,
        mimeType,
        sizeBytes: sizeBytes || null,
        storageBucket: ASSETS_BUCKET,
        storagePath,
        previewBucket: PREVIEWS_BUCKET,
        previewPath,
      })
      .returning()

    // Create signed upload URLs
    const [assetUpload, previewUpload] = await Promise.all([
      createSignedUploadUrl(supabase, {
        bucket: ASSETS_BUCKET,
        path: storagePath,
      }),
      createSignedUploadUrl(supabase, {
        bucket: PREVIEWS_BUCKET,
        path: previewPath,
      }),
    ])

    return NextResponse.json({
      assetId: asset.id,
      assetUpload: {
        signedUrl: assetUpload.signedUrl,
        token: assetUpload.token,
        path: assetUpload.path,
      },
      previewUpload: {
        signedUrl: previewUpload.signedUrl,
        token: previewUpload.token,
        path: previewUpload.path,
      },
    })
  } catch (error) {
    console.error('Init upload error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize upload' },
      { status: 500 },
    )
  }
}

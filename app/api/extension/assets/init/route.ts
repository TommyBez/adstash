import { createClient } from '@supabase/supabase-js'
import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assets } from '@/db/schema/assets'
import {
  hashPAT,
  personalAccessTokens,
} from '@/db/schema/personal-access-tokens'
import {
  ASSETS_BUCKET,
  createSignedUploadUrl,
  generateAssetPath,
  PREVIEWS_BUCKET,
} from '@/lib/supabase/storage'

// Create admin supabase client for storage operations
function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!(supabaseUrl && serviceRoleKey)) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY must be set',
    )
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

async function verifyPAT(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)
  const tokenHash = await hashPAT(token)

  const [pat] = await db
    .select()
    .from(personalAccessTokens)
    .where(
      and(
        eq(personalAccessTokens.tokenHash, tokenHash),
        isNull(personalAccessTokens.revokedAt),
      ),
    )

  if (!pat) {
    return null
  }

  // Update last used
  await db
    .update(personalAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(personalAccessTokens.id, pat.id))

  return pat.ownerId
}

interface InitRequest {
  filename: string
  mimeType: string
  sizeBytes?: number
  sourcePlatform?: string
  captureUrl?: string
  mediaUrl?: string
  hasBlob?: boolean
}

export async function POST(request: Request) {
  try {
    const ownerId = await verifyPAT(request.headers.get('Authorization'))

    if (!ownerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: InitRequest = await request.json()
    const {
      filename,
      mimeType,
      sizeBytes,
      sourcePlatform,
      captureUrl,
      mediaUrl,
      hasBlob,
    } = body

    if (!(filename && mimeType)) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, mimeType' },
        { status: 400 },
      )
    }

    // Generate storage paths
    const storagePath = generateAssetPath(ownerId, filename)
    const previewPath = generateAssetPath(
      ownerId,
      `preview-${filename}`,
      'previews',
    )

    // Create asset record in draft status
    const [asset] = await db
      .insert(assets)
      .values({
        ownerId,
        status: hasBlob ? 'uploading' : 'ready', // If no blob, mark as ready (URL-only capture)
        captureMethod: 'extension_capture',
        sourcePlatform: sourcePlatform || 'other',
        captureUrl: captureUrl || null,
        mediaUrl: mediaUrl || null,
        originalFilename: filename,
        mimeType,
        sizeBytes: sizeBytes || null,
        storageBucket: ASSETS_BUCKET,
        storagePath,
        previewBucket: PREVIEWS_BUCKET,
        previewPath,
      })
      .returning()

    // Create signed upload URLs (only needed if hasBlob)
    if (hasBlob) {
      const supabase = getAdminSupabase()

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
    }

    return NextResponse.json({
      assetId: asset.id,
      assetUpload: null,
      previewUpload: null,
    })
  } catch (error) {
    console.error('Extension init upload error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize upload' },
      { status: 500 },
    )
  }
}

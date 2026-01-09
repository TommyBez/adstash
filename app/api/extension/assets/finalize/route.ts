import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assets, assetTags } from '@/db/schema/assets'
import {
  hashPAT,
  personalAccessTokens,
} from '@/db/schema/personal-access-tokens'

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

  return pat.ownerId
}

interface FinalizeRequest {
  assetId: string
  width?: number
  height?: number
  durationSeconds?: number
  sha256?: string
  tagIds?: string[]
}

export async function POST(request: Request) {
  try {
    const ownerId = await verifyPAT(request.headers.get('Authorization'))

    if (!ownerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: FinalizeRequest = await request.json()
    const { assetId, width, height, durationSeconds, sha256, tagIds } = body

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
        updatedAt: new Date(),
      })
      .where(and(eq(assets.id, assetId), eq(assets.ownerId, ownerId)))
      .returning()

    if (!updatedAsset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Add tags if provided
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      await db.insert(assetTags).values(
        tagIds.map((tagId) => ({
          assetId,
          tagId,
        })),
      )
    }

    return NextResponse.json({ asset: updatedAsset })
  } catch (error) {
    console.error('Extension finalize upload error:', error)
    return NextResponse.json(
      { error: 'Failed to finalize upload' },
      { status: 500 },
    )
  }
}

import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
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

export async function GET(request: Request) {
  try {
    const ownerId = await verifyPAT(request.headers.get('Authorization'))

    if (!ownerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ valid: true, ownerId })
  } catch (error) {
    console.error('Verify token error:', error)
    return NextResponse.json(
      { error: 'Failed to verify token' },
      { status: 500 },
    )
  }
}

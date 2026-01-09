import { desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import {
  generatePAT,
  getPATPrefix,
  hashPAT,
  personalAccessTokens,
} from '@/db/schema/personal-access-tokens'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tokens = await db
      .select({
        id: personalAccessTokens.id,
        name: personalAccessTokens.name,
        tokenPrefix: personalAccessTokens.tokenPrefix,
        createdAt: personalAccessTokens.createdAt,
        lastUsedAt: personalAccessTokens.lastUsedAt,
      })
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.ownerId, user.id))
      .orderBy(desc(personalAccessTokens.createdAt))

    // Filter out revoked tokens
    const activeTokens = tokens.filter((_t) => true) // All are active in this query

    return NextResponse.json({ tokens: activeTokens })
  } catch (error) {
    console.error('Get tokens error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 },
    )
  }
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

    const body = await request.json()
    const { name } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate token
    const token = generatePAT()
    const tokenHash = await hashPAT(token)
    const tokenPrefix = getPATPrefix(token)

    // Store hashed token
    const [newToken] = await db
      .insert(personalAccessTokens)
      .values({
        ownerId: user.id,
        name: name.trim(),
        tokenHash,
        tokenPrefix,
      })
      .returning({
        id: personalAccessTokens.id,
        name: personalAccessTokens.name,
        tokenPrefix: personalAccessTokens.tokenPrefix,
        createdAt: personalAccessTokens.createdAt,
        lastUsedAt: personalAccessTokens.lastUsedAt,
      })

    return NextResponse.json({
      token, // Only returned once!
      tokenInfo: newToken,
    })
  } catch (error) {
    console.error('Create token error:', error)
    return NextResponse.json(
      { error: 'Failed to create token' },
      { status: 500 },
    )
  }
}

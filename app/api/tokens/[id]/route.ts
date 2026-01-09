import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { personalAccessTokens } from '@/db/schema/personal-access-tokens'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
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

    // Delete token (we do hard delete, could also soft delete with revokedAt)
    const _result = await db
      .delete(personalAccessTokens)
      .where(
        and(
          eq(personalAccessTokens.id, id),
          eq(personalAccessTokens.ownerId, user.id),
        ),
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete token error:', error)
    return NextResponse.json(
      { error: 'Failed to delete token' },
      { status: 500 },
    )
  }
}

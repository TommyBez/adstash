import { asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { tags } from '@/db/schema/tags'
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

    const userTags = await db
      .select()
      .from(tags)
      .where(eq(tags.ownerId, user.id))
      .orderBy(asc(tags.name))

    return NextResponse.json({ tags: userTags })
  } catch (error) {
    console.error('Get tags error:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
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
    const { name, color } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const [newTag] = await db
      .insert(tags)
      .values({
        ownerId: user.id,
        name: name.trim(),
        color: color || '#6b7280',
      })
      .returning()

    return NextResponse.json({ tag: newTag })
  } catch (error) {
    console.error('Create tag error:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}

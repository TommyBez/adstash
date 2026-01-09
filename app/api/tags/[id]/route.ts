import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { assetTags } from '@/db/schema/assets'
import { tags } from '@/db/schema/tags'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
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
    const { name, color } = body

    const updateData: Record<string, string> = {}
    if (name) {
      updateData.name = name.trim()
    }
    if (color) {
      updateData.color = color
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 },
      )
    }

    const [updatedTag] = await db
      .update(tags)
      .set(updateData)
      .where(and(eq(tags.id, id), eq(tags.ownerId, user.id)))
      .returning()

    if (!updatedTag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    return NextResponse.json({ tag: updatedTag })
  } catch (error) {
    console.error('Update tag error:', error)
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 })
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

    // Verify ownership
    const [tag] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.id, id), eq(tags.ownerId, user.id)))

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    // Delete asset-tag relationships
    await db.delete(assetTags).where(eq(assetTags.tagId, id))

    // Delete tag
    await db.delete(tags).where(eq(tags.id, id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete tag error:', error)
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
  }
}

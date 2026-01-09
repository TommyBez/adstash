'use client'

import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Tags as TagsIcon,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Tag } from '@/db/schema/tags'

const COLOR_OPTIONS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#6b7280', // gray
]

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6b7280')
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [tagToDelete, setTagToDelete] = useState<string | null>(null)

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch('/api/tags')
      if (response.ok) {
        const data = await response.json()
        setTags(data.tags)
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const openCreateDialog = () => {
    setEditingTag(null)
    setName('')
    setColor('#6b7280')
    setDialogOpen(true)
  }

  const openEditDialog = (tag: Tag) => {
    setEditingTag(tag)
    setName(tag.name)
    setColor(tag.color)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Tag name is required')
      return
    }

    setSaving(true)
    try {
      if (editingTag) {
        // Update
        const response = await fetch(`/api/tags/${editingTag.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), color }),
        })
        if (response.ok) {
          const data = await response.json()
          setTags((prev) =>
            prev.map((t) => (t.id === editingTag.id ? data.tag : t)),
          )
          toast.success('Tag updated')
        } else {
          throw new Error('Failed to update tag')
        }
      } else {
        // Create
        const response = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), color }),
        })
        if (response.ok) {
          const data = await response.json()
          setTags((prev) =>
            [...prev, data.tag].sort((a, b) => a.name.localeCompare(b.name)),
          )
          toast.success('Tag created')
        } else {
          throw new Error('Failed to create tag')
        }
      }
      setDialogOpen(false)
    } catch (_error) {
      toast.error(editingTag ? 'Failed to update tag' : 'Failed to create tag')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = (tagId: string) => {
    setTagToDelete(tagId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!tagToDelete) {
      return
    }

    try {
      const response = await fetch(`/api/tags/${tagToDelete}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setTags((prev) => prev.filter((t) => t.id !== tagToDelete))
        toast.success('Tag deleted')
        setDeleteDialogOpen(false)
        setTagToDelete(null)
      } else {
        throw new Error('Failed to delete tag')
      }
    } catch (_error) {
      toast.error('Failed to delete tag')
    }
  }

  return (
    <div className="container max-w-4xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Tags</h1>
          <p className="text-muted-foreground">
            Create and manage tags to organize your assets
          </p>
        </div>
        <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTag ? 'Edit Tag' : 'Create Tag'}
              </DialogTitle>
              <DialogDescription>
                {editingTag
                  ? 'Update your tag name and color.'
                  : 'Add a new tag to organize your assets.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Black Friday"
                  value={name}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      className={`h-8 w-8 rounded-full transition-all ${
                        color === c
                          ? 'scale-110 ring-2 ring-primary ring-offset-2'
                          : 'hover:scale-105'
                      }`}
                      key={c}
                      onClick={() => setColor(c)}
                      style={{ backgroundColor: c }}
                      type="button"
                    />
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <Label>Preview</Label>
                <div className="mt-2">
                  <Badge
                    className="text-sm"
                    style={{ borderColor: color, color }}
                    variant="outline"
                  >
                    {name || 'Tag name'}
                  </Badge>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setDialogOpen(false)} variant="outline">
                Cancel
              </Button>
              <Button disabled={saving} onClick={handleSave}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingTag ? 'Save Changes' : 'Create Tag'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && tags.length === 0 && (
        <Empty className="py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TagsIcon className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>No tags yet</EmptyTitle>
            <EmptyDescription>
              Create tags to categorize and organize your creative assets
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first tag
            </Button>
          </EmptyContent>
        </Empty>
      )}
      {!loading && tags.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <Card className="group" key={tag.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="font-medium">{tag.name}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                        size="icon"
                        variant="ghost"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(tag)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteClick(tag.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tag? It will be removed from
              all assets. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

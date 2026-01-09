'use client'

import { format } from 'date-fns'
import {
  ArrowLeft,
  Calendar,
  Download,
  ExternalLink,
  Film,
  HardDrive,
  Image as ImageIcon,
  Loader2,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import type { Asset } from '@/db/schema/assets'
import { DEFAULT_SOURCES } from '@/db/schema/sources'
import type { Tag } from '@/db/schema/tags'

interface AssetWithUrls extends Asset {
  assetUrl: string | null
  previewUrl: string | null
  tags: Tag[]
}

export default function AssetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const assetId = params.id as string

  const [asset, setAsset] = useState<AssetWithUrls | null>(null)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Editable fields
  const [notes, setNotes] = useState('')
  const [sourcePlatform, setSourcePlatform] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  const fetchAsset = useCallback(async () => {
    try {
      const response = await fetch(`/api/assets/${assetId}`)
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/assets')
          return
        }
        throw new Error('Failed to fetch asset')
      }
      const data = await response.json()
      setAsset(data.asset)
      setNotes(data.asset.notes || '')
      setSourcePlatform(data.asset.sourcePlatform)
      setSelectedTagIds(data.asset.tags.map((t: Tag) => t.id))
    } catch (error) {
      console.error('Failed to fetch asset:', error)
      toast.error('Failed to load asset')
    } finally {
      setLoading(false)
    }
  }, [assetId, router])

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch('/api/tags')
      if (response.ok) {
        const data = await response.json()
        setAllTags(data.tags)
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    }
  }, [])

  useEffect(() => {
    fetchAsset()
    fetchTags()
  }, [fetchAsset, fetchTags])

  useEffect(() => {
    if (asset) {
      const originalTagIds = asset.tags
        .map((t) => t.id)
        .sort()
        .join(',')
      const currentTagIds = selectedTagIds.sort().join(',')
      const changed =
        notes !== (asset.notes || '') ||
        sourcePlatform !== asset.sourcePlatform ||
        originalTagIds !== currentTagIds
      setHasChanges(changed)
    }
  }, [notes, sourcePlatform, selectedTagIds, asset])

  const handleSave = async () => {
    if (!asset) {
      return
    }
    setSaving(true)

    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          sourcePlatform,
          tagIds: selectedTagIds,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      // Refresh to get updated data
      await fetchAsset()
      toast.success('Changes saved')
      setHasChanges(false)
    } catch (_error) {
      toast.error('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      toast.success('Asset deleted')
      router.push('/assets')
    } catch (_error) {
      toast.error('Failed to delete asset')
      setDeleting(false)
    }
  }

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!asset) {
    return null
  }

  const isVideo = asset.mimeType.startsWith('video/')

  return (
    <div className="container max-w-6xl space-y-6 py-6">
      <AssetHeader
        asset={asset}
        deleting={deleting}
        hasChanges={hasChanges}
        onDelete={handleDelete}
        onSave={handleSave}
        saving={saving}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <AssetPreview
          asset={asset}
          isVideo={isVideo}
          notes={notes}
          setNotes={setNotes}
        />

        <AssetSidebar
          allTags={allTags}
          asset={asset}
          isVideo={isVideo}
          selectedTagIds={selectedTagIds}
          setSourcePlatform={setSourcePlatform}
          sourcePlatform={sourcePlatform}
          toggleTag={toggleTag}
        />
      </div>
    </div>
  )
}

interface AssetHeaderProps {
  asset: AssetWithUrls
  deleting: boolean
  hasChanges: boolean
  onDelete: () => void
  onSave: () => void
  saving: boolean
}

function AssetHeader({
  asset,
  deleting,
  hasChanges,
  onDelete,
  onSave,
  saving,
}: AssetHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button render={<Link href="/assets" />} size="icon" variant="ghost">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="max-w-md truncate font-bold text-xl">
            {asset.originalFilename}
          </h1>
          <p className="text-muted-foreground text-sm">
            Uploaded {format(new Date(asset.createdAt), 'PPP')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {hasChanges && (
          <Button disabled={saving} onClick={onSave}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        )}

        {asset.assetUrl && (
          <Button
            render={
              <a download={asset.originalFilename} href={asset.assetUrl} />
            }
            variant="outline"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger
            render={(props) => (
              <Button {...props} className="text-destructive" variant="outline">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Asset</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this asset and its files. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                disabled={deleting}
                onClick={onDelete}
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

interface AssetPreviewProps {
  asset: AssetWithUrls
  isVideo: boolean
  notes: string
  setNotes: (notes: string) => void
}

function AssetPreview({ asset, isVideo, notes, setNotes }: AssetPreviewProps) {
  return (
    <div className="space-y-6 lg:col-span-2">
      <Card>
        <CardContent className="p-4">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
            {isVideo && asset.assetUrl && (
              <video
                className="h-full w-full object-contain"
                controls
                poster={asset.previewUrl || undefined}
                src={asset.assetUrl}
              >
                <track kind="captions" label="English" srcLang="en" />
              </video>
            )}
            {!isVideo && (asset.previewUrl || asset.assetUrl) && (
              <Image
                alt={asset.originalFilename}
                className="object-contain"
                fill
                src={asset.assetUrl || asset.previewUrl || ''}
              />
            )}
            {!(asset.assetUrl || asset.previewUrl) && (
              <div className="flex h-full w-full items-center justify-center">
                {isVideo ? (
                  <Film className="h-16 w-16 text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-16 w-16 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this asset..."
            rows={4}
            value={notes}
          />
        </CardContent>
      </Card>
    </div>
  )
}

interface AssetSidebarProps {
  allTags: Tag[]
  asset: AssetWithUrls
  isVideo: boolean
  selectedTagIds: string[]
  setSourcePlatform: (platform: string) => void
  sourcePlatform: string
  toggleTag: (tagId: string) => void
}

function AssetSidebar({
  allTags,
  asset,
  isVideo,
  selectedTagIds,
  setSourcePlatform,
  sourcePlatform,
  toggleTag,
}: AssetSidebarProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Source Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <Select onValueChange={setSourcePlatform} value={sourcePlatform}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_SOURCES.map((source) => (
                <SelectItem key={source.key} value={source.key}>
                  {source.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {asset.captureUrl && (
            <div className="mt-3">
              <a
                className="flex items-center gap-1 text-primary text-sm hover:underline"
                href={asset.captureUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-3 w-3" />
                View original
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {allTags.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No tags created yet.{' '}
              <Link className="text-primary hover:underline" href="/tags">
                Create one
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <Badge
                  className="cursor-pointer"
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  style={{
                    borderColor: tag.color,
                    ...(selectedTagIds.includes(tag.id)
                      ? { backgroundColor: tag.color, color: 'white' }
                      : { color: tag.color }),
                  }}
                  variant={
                    selectedTagIds.includes(tag.id) ? 'default' : 'outline'
                  }
                >
                  {tag.name}
                  {selectedTagIds.includes(tag.id) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AssetDetails asset={asset} isVideo={isVideo} />
    </div>
  )
}

interface AssetDetailsProps {
  asset: AssetWithUrls
  isVideo: boolean
}

function AssetDetails({ asset, isVideo }: AssetDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-muted-foreground">
            {isVideo ? (
              <Film className="h-4 w-4" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            Type
          </span>
          <span>{asset.mimeType}</span>
        </div>

        {asset.width && asset.height && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Dimensions</span>
            <span>
              {asset.width} × {asset.height}
            </span>
          </div>
        )}

        {asset.durationSeconds && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span>{formatDuration(Number(asset.durationSeconds))}</span>
          </div>
        )}

        {asset.sizeBytes && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <HardDrive className="h-4 w-4" />
              Size
            </span>
            <span>{formatFileSize(asset.sizeBytes)}</span>
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Uploaded
          </span>
          <span>{format(new Date(asset.createdAt), 'PP')}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Capture method</span>
          <Badge variant="outline">
            {asset.captureMethod === 'extension_capture'
              ? 'Extension'
              : 'Web upload'}
          </Badge>
        </div>

        {asset.sha256 && (
          <div className="pt-2">
            <span className="text-muted-foreground text-xs">SHA-256</span>
            <p className="truncate font-mono text-xs">{asset.sha256}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

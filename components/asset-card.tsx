'use client'

import { formatDistanceToNow } from 'date-fns'
import {
  Calendar,
  ExternalLink,
  Film,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Asset } from '@/db/schema/assets'
import { DEFAULT_SOURCES } from '@/db/schema/sources'
import type { Tag } from '@/db/schema/tags'
import { cn } from '@/lib/utils'

export interface AssetWithDetails extends Asset {
  previewUrl?: string | null
  tags: Tag[]
}

interface AssetCardProps {
  asset: AssetWithDetails
  selected?: boolean
  onSelect?: (selected: boolean) => void
  onDelete?: () => void
  onTagClick?: (tagId: string) => void
  showSelection?: boolean
}

export function AssetCard({
  asset,
  selected = false,
  onSelect,
  onDelete,
  onTagClick,
  showSelection = false,
}: AssetCardProps) {
  const [imageError, setImageError] = useState(false)
  const isVideo = asset.mimeType.startsWith('video/')

  const sourceLabel =
    DEFAULT_SOURCES.find((s) => s.key === asset.sourcePlatform)?.label ||
    asset.sourcePlatform

  return (
    <Card className="group overflow-hidden transition-all hover:border-primary/50 hover:shadow-lg">
      <div className="relative aspect-video bg-muted">
        {/* Selection checkbox */}
        {showSelection && (
          <div className="absolute top-2 left-2 z-10">
            <Checkbox
              checked={selected}
              className="border-2 bg-background/80 backdrop-blur-sm"
              onCheckedChange={(checked) => onSelect?.(checked as boolean)}
            />
          </div>
        )}

        {/* Preview image */}
        <Link className="block h-full w-full" href={`/assets/${asset.id}`}>
          {asset.previewUrl && !imageError ? (
            <Image
              alt={asset.originalFilename}
              className="object-cover transition-transform group-hover:scale-105"
              fill
              onError={() => setImageError(true)}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              src={asset.previewUrl}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              {isVideo ? (
                <Film className="h-12 w-12" />
              ) : (
                <div className="p-4 text-center">
                  <p className="truncate text-sm">{asset.originalFilename}</p>
                </div>
              )}
            </div>
          )}
        </Link>

        {/* Video badge */}
        {isVideo && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-white text-xs">
            <Film className="h-3 w-3" />
            {asset.durationSeconds &&
              formatDuration(Number(asset.durationSeconds))}
          </div>
        )}

        {/* Source badge */}
        <Badge
          className="absolute top-2 right-2 bg-background/80 text-xs backdrop-blur-sm"
          variant="secondary"
        >
          {sourceLabel}
        </Badge>

        {/* Actions overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
          <div className="absolute right-2 bottom-2 flex gap-1">
            {asset.captureUrl && (
              <Button
                className="h-8 w-8"
                render={
                  <a
                    href={asset.captureUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  />
                }
                size="icon"
                variant="secondary"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(props) => (
                  <Button
                    {...props}
                    className="h-8 w-8"
                    size="icon"
                    variant="secondary"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                )}
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  render={<Link href={`/assets/${asset.id}`} />}
                >
                  View Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <CardContent className="space-y-2 p-3">
        {/* Filename */}
        <Link href={`/assets/${asset.id}`}>
          <p className="truncate font-medium text-sm hover:underline">
            {asset.originalFilename}
          </p>
        </Link>

        {/* Meta info */}
        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDistanceToNow(new Date(asset.createdAt), {
              addSuffix: true,
            })}
          </span>
          {asset.width && asset.height && (
            <span>
              {asset.width}×{asset.height}
            </span>
          )}
        </div>

        {/* Tags */}
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {asset.tags.slice(0, 3).map((tag) => (
              <Badge
                className="cursor-pointer text-xs hover:bg-accent"
                key={tag.id}
                onClick={(e) => {
                  e.preventDefault()
                  onTagClick?.(tag.id)
                }}
                style={{ borderColor: tag.color, color: tag.color }}
                variant="outline"
              >
                {tag.name}
              </Badge>
            ))}
            {asset.tags.length > 3 && (
              <Badge className="text-xs" variant="outline">
                +{asset.tags.length - 3}
              </Badge>
            )}
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

// List view variant
interface AssetListItemProps extends AssetCardProps {}

export function AssetListItem({
  asset,
  selected = false,
  onSelect,
  onDelete,
  onTagClick,
  showSelection = false,
}: AssetListItemProps) {
  const [imageError, setImageError] = useState(false)
  const isVideo = asset.mimeType.startsWith('video/')
  const sourceLabel =
    DEFAULT_SOURCES.find((s) => s.key === asset.sourcePlatform)?.label ||
    asset.sourcePlatform

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50',
        selected && 'ring-2 ring-primary',
      )}
    >
      {/* Selection */}
      {showSelection && (
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect?.(checked as boolean)}
        />
      )}

      {/* Thumbnail */}
      <Link
        className="relative h-16 w-24 flex-shrink-0 overflow-hidden rounded bg-muted"
        href={`/assets/${asset.id}`}
      >
        {asset.previewUrl && !imageError ? (
          <Image
            alt={asset.originalFilename}
            className="object-cover"
            fill
            onError={() => setImageError(true)}
            src={asset.previewUrl}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        {isVideo && (
          <div className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[10px] text-white">
            <Film className="mr-0.5 inline h-2.5 w-2.5" />
            {asset.durationSeconds &&
              formatDuration(Number(asset.durationSeconds))}
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="min-w-0 flex-1 space-y-1">
        <Link className="hover:underline" href={`/assets/${asset.id}`}>
          <p className="truncate font-medium text-sm">
            {asset.originalFilename}
          </p>
        </Link>
        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          <Badge className="text-xs" variant="secondary">
            {sourceLabel}
          </Badge>
          <span>
            {formatDistanceToNow(new Date(asset.createdAt), {
              addSuffix: true,
            })}
          </span>
          {asset.width && asset.height && (
            <span>
              {asset.width}×{asset.height}
            </span>
          )}
          {asset.sizeBytes && <span>{formatFileSize(asset.sizeBytes)}</span>}
        </div>
      </div>

      {/* Tags */}
      <div className="hidden max-w-[200px] flex-wrap gap-1 md:flex">
        {asset.tags.slice(0, 2).map((tag) => (
          <Badge
            className="cursor-pointer text-xs hover:bg-accent"
            key={tag.id}
            onClick={() => onTagClick?.(tag.id)}
            style={{ borderColor: tag.color, color: tag.color }}
            variant="outline"
          >
            {tag.name}
          </Badge>
        ))}
        {asset.tags.length > 2 && (
          <Badge className="text-xs" variant="outline">
            +{asset.tags.length - 2}
          </Badge>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {asset.captureUrl && (
          <Button
            className="h-8 w-8"
            render={
              <a
                href={asset.captureUrl}
                rel="noopener noreferrer"
                target="_blank"
              />
            }
            size="icon"
            variant="ghost"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button
                {...props}
                className="h-8 w-8"
                size="icon"
                variant="ghost"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href={`/assets/${asset.id}`} />}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
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

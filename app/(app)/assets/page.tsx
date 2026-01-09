'use client'

import { Images, Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState } from 'react'
import {
  AssetCard,
  AssetListItem,
  type AssetWithDetails,
} from '@/components/asset-card'
import { AssetFilters } from '@/components/asset-filters'
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
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import type { Tag } from '@/db/schema/tags'

function AssetsContent() {
  const searchParams = useSearchParams()
  const [assets, setAssets] = useState<AssetWithDetails[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())

  const fetchAssets = useCallback(
    async (pageNum: number, append = false) => {
      const isFirstPage = pageNum === 1
      if (isFirstPage) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      try {
        const params = new URLSearchParams(searchParams.toString())
        params.set('page', pageNum.toString())
        params.set('limit', '24')

        const response = await fetch(`/api/assets?${params}`)
        if (!response.ok) {
          throw new Error('Failed to fetch assets')
        }

        const data = await response.json()

        if (append) {
          setAssets((prev) => [...prev, ...data.assets])
        } else {
          setAssets(data.assets)
        }

        setHasMore(data.pagination.hasMore)
        setTotalCount(data.pagination.totalCount)
      } catch (error) {
        console.error('Failed to fetch assets:', error)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [searchParams],
  )

  const fetchTags = useCallback(async () => {
    try {
      const response = await fetch('/api/tags')
      if (response.ok) {
        const data = await response.json()
        setTags(data.tags)
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    }
  }, [])

  useEffect(() => {
    setPage(1)
    fetchAssets(1)
  }, [fetchAssets])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchAssets(nextPage, true)
  }

  const toggleSelection = (assetId: string, selected: boolean) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(assetId)
      } else {
        next.delete(assetId)
      }
      return next
    })
  }

  const handleTagClick = (tagId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const currentTags = params.get('tags')?.split(',').filter(Boolean) || []
    if (!currentTags.includes(tagId)) {
      currentTags.push(tagId)
      params.set('tags', currentTags.join(','))
      window.location.href = `/assets?${params}`
    }
  }

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null)

  const handleDeleteClick = (assetId: string) => {
    setAssetToDelete(assetId)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!assetToDelete) {
      return
    }

    try {
      const response = await fetch(`/api/assets/${assetToDelete}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== assetToDelete))
        setTotalCount((prev) => prev - 1)
        setDeleteDialogOpen(false)
        setAssetToDelete(null)
      }
    } catch (error) {
      console.error('Failed to delete asset:', error)
    }
  }

  return (
    <div className="container space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Assets</h1>
          <p className="text-muted-foreground">
            Manage your creative ads library
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/upload" />}>
          <Plus className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </div>

      {/* Filters */}
      <AssetFilters
        onViewModeChange={setViewMode}
        tags={tags}
        totalCount={totalCount}
        viewMode={viewMode}
      />

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && assets.length === 0 && (
        <Empty className="py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Images className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>No assets found</EmptyTitle>
            <EmptyDescription>
              {searchParams.toString()
                ? 'Try adjusting your filters or search query'
                : 'Upload your first creative asset to get started'}
            </EmptyDescription>
          </EmptyHeader>
          {!searchParams.toString() && (
            <EmptyContent>
              <Button nativeButton={false} render={<Link href="/upload" />}>
                <Plus className="mr-2 h-4 w-4" />
                Upload Asset
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}
      {!loading && assets.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => (
            <AssetCard
              asset={asset}
              key={asset.id}
              onDelete={() => handleDeleteClick(asset.id)}
              onSelect={(selected) => toggleSelection(asset.id, selected)}
              onTagClick={handleTagClick}
              selected={selectedAssets.has(asset.id)}
            />
          ))}
        </div>
      )}
      {!loading && assets.length > 0 && viewMode === 'list' && (
        <div className="space-y-2">
          {assets.map((asset) => (
            <AssetListItem
              asset={asset}
              key={asset.id}
              onDelete={() => handleDeleteClick(asset.id)}
              onSelect={(selected) => toggleSelection(asset.id, selected)}
              onTagClick={handleTagClick}
              selected={selectedAssets.has(asset.id)}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center py-4">
          <Button disabled={loadingMore} onClick={loadMore} variant="outline">
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load more'
            )}
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this asset? This action cannot be
              undone.
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

export default function AssetsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AssetsContent />
    </Suspense>
  )
}

'use client'

import { format } from 'date-fns'
import { Film, Filter, Grid3X3, Image, List, Search, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { DEFAULT_SOURCES } from '@/db/schema/sources'
import type { Tag } from '@/db/schema/tags'

interface AssetFiltersProps {
  tags: Tag[]
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  totalCount?: number
}

export function AssetFilters({
  tags,
  viewMode,
  onViewModeChange,
  totalCount,
}: AssetFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [source, setSource] = useState(searchParams.get('source') || '')
  const [type, setType] = useState(searchParams.get('type') || '')
  const [selectedTags, setSelectedTags] = useState<string[]>(
    searchParams.get('tags')?.split(',').filter(Boolean) || [],
  )
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (from || to) {
      return {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      }
    }
    return undefined
  })

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Update URL when filters change
  const updateFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) {
      params.set('search', debouncedSearch)
    }
    if (source) {
      params.set('source', source)
    }
    if (type) {
      params.set('type', type)
    }
    if (selectedTags.length > 0) {
      params.set('tags', selectedTags.join(','))
    }
    if (dateRange?.from) {
      params.set('from', dateRange.from.toISOString().split('T')[0])
    }
    if (dateRange?.to) {
      params.set('to', dateRange.to.toISOString().split('T')[0])
    }

    const queryString = params.toString()
    router.push(`/assets${queryString ? `?${queryString}` : ''}`)
  }, [debouncedSearch, source, type, selectedTags, dateRange, router])

  useEffect(() => {
    updateFilters()
  }, [updateFilters])

  const clearFilters = () => {
    setSearch('')
    setSource('')
    setType('')
    setSelectedTags([])
    setDateRange(undefined)
  }

  const hasFilters =
    search || source || type || selectedTags.length > 0 || dateRange

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    )
  }

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) {
      return <span className="text-muted-foreground">Date range</span>
    }
    if (range.to) {
      return (
        <>
          {format(range.from, 'MMM d')} - {format(range.to, 'MMM d')}
        </>
      )
    }
    return format(range.from, 'MMM d, yyyy')
  }

  const renderTypeLabel = () => {
    if (!type) {
      return <span className="text-muted-foreground">All types</span>
    }
    if (type === 'image') {
      return (
        <span className="flex items-center gap-2">
          <Image className="h-4 w-4" />
          Images
        </span>
      )
    }
    if (type === 'video') {
      return (
        <span className="flex items-center gap-2">
          <Film className="h-4 w-4" />
          Videos
        </span>
      )
    }
    return 'All types'
  }

  return (
    <div className="space-y-4">
      {/* Search + View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pr-9 pl-9"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets..."
            value={search}
          />
          {search && (
            <Button
              className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
              onClick={() => setSearch('')}
              size="icon"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center rounded-lg border p-1">
          <Toggle
            aria-label="Grid view"
            className="rounded-md"
            onPressedChange={() => onViewModeChange('grid')}
            pressed={viewMode === 'grid'}
            size="sm"
          >
            <Grid3X3 className="h-4 w-4" />
          </Toggle>
          <Toggle
            aria-label="List view"
            className="rounded-md"
            onPressedChange={() => onViewModeChange('list')}
            pressed={viewMode === 'list'}
            size="sm"
          >
            <List className="h-4 w-4" />
          </Toggle>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Source filter */}
        <Select
          onValueChange={(value) => setSource(value ?? '')}
          value={source}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue>
              {source ? (
                DEFAULT_SOURCES.find((s) => s.key === source)?.label ||
                'All sources'
              ) : (
                <span className="text-muted-foreground">All sources</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {DEFAULT_SOURCES.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type filter */}
        <Select onValueChange={(value) => setType(value ?? '')} value={type}>
          <SelectTrigger className="w-[130px]">
            <SelectValue>{renderTypeLabel()}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="image">
              <span className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                Images
              </span>
            </SelectItem>
            <SelectItem value="video">
              <span className="flex items-center gap-2">
                <Film className="h-4 w-4" />
                Videos
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Date range filter */}
        <Popover>
          <PopoverTrigger
            render={(props) => (
              <Button
                {...props}
                className="w-[200px] justify-start font-normal"
                variant="outline"
              >
                {formatDateRange(dateRange)}
              </Button>
            )}
          />
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="range"
              numberOfMonths={2}
              onSelect={setDateRange}
              selected={dateRange}
            />
            {dateRange && (
              <div className="border-t p-2">
                <Button
                  className="w-full"
                  onClick={() => setDateRange(undefined)}
                  size="sm"
                  variant="ghost"
                >
                  Clear dates
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Tags filter */}
        {tags.length > 0 && (
          <Popover>
            <PopoverTrigger
              render={(props) => (
                <Button {...props} className="gap-2" variant="outline">
                  <Filter className="h-4 w-4" />
                  Tags
                  {selectedTags.length > 0 && (
                    <Badge className="ml-1" variant="secondary">
                      {selectedTags.length}
                    </Badge>
                  )}
                </Button>
              )}
            />
            <PopoverContent align="start" className="w-[250px]">
              <div className="space-y-2">
                <p className="font-medium text-sm">Filter by tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge
                      className="cursor-pointer"
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      style={{
                        borderColor: tag.color,
                        ...(selectedTags.includes(tag.id)
                          ? { backgroundColor: tag.color, color: 'white' }
                          : { color: tag.color }),
                      }}
                      variant={
                        selectedTags.includes(tag.id) ? 'default' : 'outline'
                      }
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
                {selectedTags.length > 0 && (
                  <Button
                    className="mt-2 w-full"
                    onClick={() => setSelectedTags([])}
                    size="sm"
                    variant="ghost"
                  >
                    Clear tags
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Clear all button */}
        {hasFilters && (
          <Button onClick={clearFilters} size="sm" variant="ghost">
            <X className="mr-1 h-4 w-4" />
            Clear all
          </Button>
        )}

        {/* Results count */}
        {totalCount !== undefined && (
          <span className="ml-auto text-muted-foreground text-sm">
            {totalCount} asset{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Active filter badges */}
      {(selectedTags.length > 0 || dateRange) && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tagId) => {
            const tag = tags.find((t) => t.id === tagId)
            if (!tag) {
              return null
            }
            return (
              <Badge
                className="gap-1"
                key={tagId}
                style={{ borderColor: tag.color, color: tag.color }}
                variant="secondary"
              >
                {tag.name}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => toggleTag(tagId)}
                />
              </Badge>
            )
          })}
          {dateRange && (
            <Badge className="gap-1" variant="secondary">
              {dateRange.from && format(dateRange.from, 'MMM d')}
              {dateRange.to && ` - ${format(dateRange.to, 'MMM d')}`}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setDateRange(undefined)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

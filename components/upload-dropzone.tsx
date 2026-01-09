'use client'

import {
  AlertCircle,
  CheckCircle2,
  Film,
  Image as ImageIcon,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import Image from 'next/image'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DEFAULT_SOURCES } from '@/db/schema/sources'
import {
  ACCEPTED_FILE_TYPES,
  finalizeUpload,
  generateImagePreview,
  generateVideoPreview,
  initUpload,
  isImageFile,
  isVideoFile,
  MAX_FILE_SIZE,
  uploadToStorage,
} from '@/lib/upload'
import { cn } from '@/lib/utils'

interface FileUpload {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error'
  progress: number
  error?: string
  previewUrl?: string
  sourcePlatform: string
}

interface UploadDropzoneProps {
  onUploadComplete?: (assetIds: string[]) => void
  className?: string
}

export function UploadDropzone({
  onUploadComplete,
  className,
}: UploadDropzoneProps) {
  const [files, setFiles] = useState<FileUpload[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)
    const validFiles = fileArray.filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`File ${file.name} exceeds max size`)
        return false
      }
      if (!(isImageFile(file) || isVideoFile(file))) {
        console.warn(`File ${file.name} is not a supported type`)
        return false
      }
      return true
    })

    const uploads: FileUpload[] = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: 'pending',
      progress: 0,
      sourcePlatform: 'other',
      previewUrl: isImageFile(file) ? URL.createObjectURL(file) : undefined,
    }))

    setFiles((prev) => [...prev, ...uploads])
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl)
      }
      return prev.filter((f) => f.id !== id)
    })
  }, [])

  const updateFile = useCallback((id: string, updates: Partial<FileUpload>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    )
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      addFiles(e.dataTransfer.files)
    },
    [addFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const generatePreview = async (file: File) => {
    if (isImageFile(file)) {
      try {
        const preview = await generateImagePreview(file)
        return {
          blob: preview.blob,
          width: preview.width,
          height: preview.height,
          duration: undefined,
        }
      } catch (e) {
        console.warn('Failed to generate image preview:', e)
        return null
      }
    }

    if (isVideoFile(file)) {
      try {
        const preview = await generateVideoPreview(file)
        return {
          blob: preview.blob,
          width: preview.width,
          height: preview.height,
          duration: preview.duration,
        }
      } catch (e) {
        console.warn('Failed to generate video preview:', e)
        return null
      }
    }

    return null
  }

  const uploadSingleFile = async (fileUpload: FileUpload) => {
    updateFile(fileUpload.id, { status: 'uploading', progress: 0 })

    const { assetId, assetUpload, previewUpload } = await initUpload(
      fileUpload.file,
      { sourcePlatform: fileUpload.sourcePlatform },
    )

    updateFile(fileUpload.id, { status: 'processing', progress: 10 })
    const previewData = await generatePreview(fileUpload.file)

    updateFile(fileUpload.id, { progress: 20 })
    await uploadToStorage(
      fileUpload.file,
      assetUpload.signedUrl,
      assetUpload.token,
      (progress) =>
        updateFile(fileUpload.id, { progress: 20 + progress * 0.6 }),
    )

    if (previewData?.blob && previewUpload) {
      updateFile(fileUpload.id, { progress: 85 })
      await uploadToStorage(
        previewData.blob,
        previewUpload.signedUrl,
        previewUpload.token,
      )
    }

    updateFile(fileUpload.id, { progress: 95 })
    await finalizeUpload(assetId, {
      width: previewData?.width,
      height: previewData?.height,
      durationSeconds: previewData?.duration,
      sizeBytes: fileUpload.file.size,
    })

    updateFile(fileUpload.id, { status: 'done', progress: 100 })
    return assetId
  }

  const uploadFiles = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending')
    if (pendingFiles.length === 0) {
      return
    }

    setIsUploading(true)
    const completedIds: string[] = []

    for (const fileUpload of pendingFiles) {
      try {
        const assetId = await uploadSingleFile(fileUpload)
        completedIds.push(assetId)
      } catch (error) {
        console.error('Upload error:', error)
        updateFile(fileUpload.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Upload failed',
        })
      }
    }

    setIsUploading(false)

    if (completedIds.length > 0 && onUploadComplete) {
      onUploadComplete(completedIds)
    }
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const completedCount = files.filter((f) => f.status === 'done').length

  return (
    <div className={cn('space-y-6', className)}>
      {/* Dropzone */}
      <button
        aria-label="File upload dropzone"
        className={cn(
          'relative w-full rounded-xl border-2 border-dashed p-12 text-center transition-all duration-200',
          isDragging
            ? 'scale-[1.02] border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30',
        )}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        type="button"
      >
        <input
          accept={Object.entries(ACCEPTED_FILE_TYPES)
            .flatMap(([k, v]) => [k, ...v])
            .join(',')}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          multiple
          onChange={(e) => e.target.files && addFiles(e.target.files)}
          type="file"
        />
        <div className="space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-medium text-lg">
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="mt-1 text-muted-foreground text-sm">
              or click to browse • Images and videos up to 100MB
            </p>
          </div>
        </div>
      </button>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              {pendingCount > 0
                ? `${pendingCount} file${pendingCount > 1 ? 's' : ''} ready to upload`
                : `${completedCount} file${completedCount > 1 ? 's' : ''} uploaded`}
            </h3>
            {pendingCount > 0 && (
              <Button disabled={isUploading} onClick={uploadFiles}>
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload {pendingCount} file{pendingCount > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="grid gap-3">
            {files.map((fileUpload) => (
              <FileUploadItem
                disabled={isUploading || fileUpload.status !== 'pending'}
                fileUpload={fileUpload}
                key={fileUpload.id}
                onRemove={() => removeFile(fileUpload.id)}
                onSourceChange={(source) =>
                  updateFile(fileUpload.id, { sourcePlatform: source })
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface FileUploadItemProps {
  fileUpload: FileUpload
  onRemove: () => void
  onSourceChange: (source: string) => void
  disabled?: boolean
}

function FileUploadItem({
  fileUpload,
  onRemove,
  onSourceChange,
  disabled,
}: FileUploadItemProps) {
  const _isImage = isImageFile(fileUpload.file)
  const isVideo = isVideoFile(fileUpload.file)

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      {/* Preview */}
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
        {fileUpload.previewUrl ? (
          <Image
            alt={fileUpload.file.name}
            className="object-cover"
            fill
            src={fileUpload.previewUrl}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {isVideo ? (
              <Film className="h-6 w-6 text-muted-foreground" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
        )}
        {isVideo && (
          <div className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-white text-xs">
            Video
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{fileUpload.file.name}</p>
          <span className="flex-shrink-0 text-muted-foreground text-xs">
            {(fileUpload.file.size / (1024 * 1024)).toFixed(1)} MB
          </span>
        </div>

        {fileUpload.status === 'pending' && (
          <Select
            disabled={disabled}
            onValueChange={onSourceChange}
            value={fileUpload.sourcePlatform}
          >
            <SelectTrigger className="h-8 w-48">
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_SOURCES.map((source) => (
                <SelectItem key={source.key} value={source.key}>
                  {source.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(fileUpload.status === 'uploading' ||
          fileUpload.status === 'processing') && (
          <div className="space-y-1">
            <Progress className="h-1.5" value={fileUpload.progress} />
            <p className="text-muted-foreground text-xs">
              {fileUpload.status === 'processing'
                ? 'Processing...'
                : 'Uploading...'}
            </p>
          </div>
        )}

        {fileUpload.status === 'error' && (
          <p className="flex items-center gap-1 text-destructive text-xs">
            <AlertCircle className="h-3 w-3" />
            {fileUpload.error}
          </p>
        )}
      </div>

      {/* Status / Actions */}
      <div className="flex-shrink-0">
        {fileUpload.status === 'done' && (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        )}
        {fileUpload.status === 'error' && (
          <AlertCircle className="h-5 w-5 text-destructive" />
        )}
        {(fileUpload.status === 'uploading' ||
          fileUpload.status === 'processing') && (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        )}
        {fileUpload.status === 'pending' && (
          <Button
            className="h-8 w-8"
            disabled={disabled}
            onClick={onRemove}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

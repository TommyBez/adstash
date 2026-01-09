/**
 * Upload utilities for client-side operations
 */

export interface UploadResult {
  assetId: string
  success: boolean
  error?: string
}

export interface InitUploadResponse {
  assetId: string
  assetUpload: {
    signedUrl: string
    token: string
    path: string
  }
  previewUpload: {
    signedUrl: string
    token: string
    path: string
  }
}

/**
 * Initialize an upload by getting signed URLs from the server
 */
export async function initUpload(
  file: File,
  options?: {
    sourcePlatform?: string
    captureUrl?: string
  },
): Promise<InitUploadResponse> {
  const response = await fetch('/api/assets/init-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      sourcePlatform: options?.sourcePlatform,
      captureUrl: options?.captureUrl,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to initialize upload')
  }

  return response.json()
}

/**
 * Upload a file directly to Supabase Storage using a signed URL
 */
export function uploadToStorage(
  file: Blob,
  signedUrl: string,
  token: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress((event.loaded / event.total) * 100)
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'))
    })

    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader(
      'Content-Type',
      file.type || 'application/octet-stream',
    )
    xhr.send(file)
  })
}

/**
 * Finalize an upload after files have been uploaded
 */
export async function finalizeUpload(
  assetId: string,
  metadata: {
    width?: number
    height?: number
    durationSeconds?: number
    sha256?: string
    sizeBytes?: number
    notes?: string
  },
): Promise<void> {
  const response = await fetch('/api/assets/finalize-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId, ...metadata }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to finalize upload')
  }
}

/**
 * Generate a preview/thumbnail for an image
 */
export function generateImagePreview(
  file: File,
  maxSize = 400,
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      // Calculate dimensions
      let { width, height } = img
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        }
      } else if (height > maxSize) {
        width = (width * maxSize) / height
        height = maxSize
      }

      // Draw to canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              width: img.naturalWidth,
              height: img.naturalHeight,
            })
          } else {
            reject(new Error('Failed to generate preview'))
          }
        },
        'image/webp',
        0.8,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Generate a preview/thumbnail for a video (captures first frame)
 */
export function generateVideoPreview(
  file: File,
  maxSize = 400,
): Promise<{ blob: Blob; width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, video.duration / 4) // Capture at 25% or 1s
    }

    video.onseeked = () => {
      // Calculate dimensions
      let { videoWidth: width, videoHeight: height } = video
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        }
      } else if (height > maxSize) {
        width = (width * maxSize) / height
        height = maxSize
      }

      // Draw to canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      ctx.drawImage(video, 0, 0, width, height)

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          if (blob) {
            resolve({
              blob,
              width: video.videoWidth,
              height: video.videoHeight,
              duration: video.duration,
            })
          } else {
            reject(new Error('Failed to generate video preview'))
          }
        },
        'image/webp',
        0.8,
      )
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    }

    video.src = url
    video.load()
  })
}

/**
 * Calculate SHA-256 hash of a file
 */
export async function calculateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Check if a file is a video
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

/**
 * Get accepted file types for the dropzone
 */
export const ACCEPTED_FILE_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
  'video/*': ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
}

/**
 * Max file size (100MB)
 */
export const MAX_FILE_SIZE = 100 * 1024 * 1024

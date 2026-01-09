// Service worker (background script) for the extension

import type {
  CaptureRequest,
  InitUploadResponse,
  Message,
  UploadCompletePayload,
  UploadErrorPayload,
  UploadProgressPayload,
} from './types'
import { getConfig } from './utils/storage'

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener(
  (message: Message, sender, sendResponse) => {
    if (message.type === 'CAPTURE_MEDIA') {
      handleCaptureMedia(message.payload as CaptureRequest, sender.tab?.id)
        .then((result) => sendResponse({ success: true, ...result }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message }),
        )
      return true // Indicates async response
    }
  },
)

async function handleCaptureMedia(
  request: CaptureRequest,
  tabId?: number,
): Promise<{ assetId: string }> {
  const config = await getConfig()

  if (!config.accessToken) {
    throw new Error(
      'Not configured. Please add your access token in extension settings.',
    )
  }

  const { candidate, pageContext, tagIds } = request

  // Notify progress
  notifyProgress(tabId, candidate.id, 5)

  // Try to download the media blob
  let blob: Blob | null = null
  const _mediaUrl = candidate.url

  try {
    const response = await fetch(candidate.url, {
      mode: 'cors',
      credentials: 'omit',
    })

    if (response.ok) {
      blob = await response.blob()
      notifyProgress(tabId, candidate.id, 20)
    }
  } catch (error) {
    console.warn('Failed to download media, will store URL only:', error)
  }

  // Determine filename and mime type
  const urlPath = new URL(candidate.url).pathname
  const filename = urlPath.split('/').pop() || `capture-${Date.now()}`
  const mimeType =
    blob?.type || (candidate.type === 'video' ? 'video/mp4' : 'image/jpeg')

  // Initialize upload with API
  const initResponse = await fetch(
    `${config.apiUrl}/api/extension/assets/init`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        filename,
        mimeType,
        sizeBytes: blob?.size,
        sourcePlatform: pageContext.sourcePlatform,
        captureUrl: pageContext.url,
        mediaUrl: candidate.url,
        hasBlob: !!blob,
      }),
    },
  )

  if (!initResponse.ok) {
    const error = await initResponse.json()
    throw new Error(error.error || 'Failed to initialize upload')
  }

  const initData: InitUploadResponse = await initResponse.json()
  notifyProgress(tabId, candidate.id, 30)

  // Upload blob if we have it
  if (blob) {
    await uploadToStorage(
      blob,
      initData.assetUpload.signedUrl,
      initData.assetUpload.token,
      (progress) => notifyProgress(tabId, candidate.id, 30 + progress * 0.5),
    )
  }

  notifyProgress(tabId, candidate.id, 85)

  // Generate and upload thumbnail for images
  if (blob && candidate.type === 'image') {
    try {
      const thumbnail = await generateImageThumbnail(blob)
      if (thumbnail) {
        await uploadToStorage(
          thumbnail,
          initData.previewUpload.signedUrl,
          initData.previewUpload.token,
        )
      }
    } catch (e) {
      console.warn('Failed to generate thumbnail:', e)
    }
  }

  notifyProgress(tabId, candidate.id, 90)

  // Finalize upload
  const finalizeResponse = await fetch(
    `${config.apiUrl}/api/extension/assets/finalize`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        assetId: initData.assetId,
        width: candidate.width,
        height: candidate.height,
        tagIds,
      }),
    },
  )

  if (!finalizeResponse.ok) {
    const error = await finalizeResponse.json()
    throw new Error(error.error || 'Failed to finalize upload')
  }

  notifyProgress(tabId, candidate.id, 100)
  notifyComplete(tabId, candidate.id, initData.assetId)

  return { assetId: initData.assetId }
}

async function uploadToStorage(
  blob: Blob,
  signedUrl: string,
  token: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  // Note: fetch doesn't support upload progress in service workers
  // For MVP, we'll just do a simple upload
  const response = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': blob.type || 'application/octet-stream',
    },
    body: blob,
  })

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`)
  }

  onProgress?.(100)
}

async function generateImageThumbnail(blob: Blob): Promise<Blob | null> {
  // In service worker, we can use OffscreenCanvas
  const bitmap = await createImageBitmap(blob)

  const maxSize = 400
  let { width, height } = bitmap

  if (width > height) {
    if (width > maxSize) {
      height = (height * maxSize) / width
      width = maxSize
    }
  } else if (height > maxSize) {
    width = (width * maxSize) / height
    height = maxSize
  }

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })
}

function notifyProgress(
  _tabId: number | undefined,
  candidateId: string,
  progress: number,
) {
  const payload: UploadProgressPayload = { candidateId, progress }
  chrome.runtime.sendMessage({ type: 'UPLOAD_PROGRESS', payload })
}

function notifyComplete(
  _tabId: number | undefined,
  candidateId: string,
  assetId: string,
) {
  const payload: UploadCompletePayload = { candidateId, assetId }
  chrome.runtime.sendMessage({ type: 'UPLOAD_COMPLETE', payload })
}

function _notifyError(
  _tabId: number | undefined,
  candidateId: string,
  error: string,
) {
  const payload: UploadErrorPayload = { candidateId, error }
  chrome.runtime.sendMessage({ type: 'UPLOAD_ERROR', payload })
}

// Handle extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage()
  }
})

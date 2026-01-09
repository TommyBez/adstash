// Content script - scans page for media candidates

import type {
  GetCandidatesResponse,
  MediaCandidate,
  Message,
  PageContext,
} from './types'
import { detectSourceFromUrl } from './utils/source-detection'

// Regex patterns (defined at top level for performance)
const BG_IMAGE_URL_REGEX = /url\(["']?([^"')]+)["']?\)/
const INSTAGRAM_VIDEO_REGEX = /"video_url":"([^"]+)"/g
const INSTAGRAM_IMAGE_REGEX = /"display_url":"([^"]+)"/g
const TIKTOK_VIDEO_REGEX = /"playAddr":"([^"]+)"/g

// Listen for messages from popup
chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse) => {
    if (message.type === 'GET_CANDIDATES') {
      const response = getCandidates()
      sendResponse(response)
      return true
    }
  },
)

function scanImages(candidates: MediaCandidate[], seenUrls: Set<string>): void {
  const images = document.querySelectorAll('img')
  let imageIndex = 0
  for (const img of images) {
    const url = img.currentSrc || img.src
    if (!url || url.startsWith('data:') || seenUrls.has(url)) {
      continue
    }

    // Filter out small images (likely icons)
    if (img.naturalWidth < 100 || img.naturalHeight < 100) {
      continue
    }

    seenUrls.add(url)
    candidates.push({
      id: `img-${imageIndex}-${Date.now()}`,
      type: 'image',
      url,
      width: img.naturalWidth,
      height: img.naturalHeight,
      alt: img.alt || undefined,
    })
    imageIndex++
  }
}

function scanBackgroundImages(
  candidates: MediaCandidate[],
  seenUrls: Set<string>,
): void {
  const elementsWithBg = document.querySelectorAll(
    '[style*="background-image"]',
  )
  let bgIndex = 0
  for (const el of elementsWithBg) {
    const style = getComputedStyle(el)
    const bgImage = style.backgroundImage
    const match = bgImage.match(BG_IMAGE_URL_REGEX)
    if (!match) {
      continue
    }

    const url = match[1]
    if (url.startsWith('data:') || seenUrls.has(url)) {
      continue
    }

    seenUrls.add(url)
    candidates.push({
      id: `bg-${bgIndex}-${Date.now()}`,
      type: 'image',
      url,
    })
    bgIndex++
  }
}

function getVideoUrl(video: HTMLVideoElement): string {
  let url = video.currentSrc || video.src
  if (!url) {
    const source = video.querySelector('source')
    url = source?.src || ''
  }
  return url
}

function handleBlobVideo(
  video: HTMLVideoElement,
  videoIndex: number,
  candidates: MediaCandidate[],
  seenUrls: Set<string>,
): boolean {
  const poster = video.poster
  if (poster && !seenUrls.has(poster)) {
    seenUrls.add(poster)
    candidates.push({
      id: `video-poster-${videoIndex}-${Date.now()}`,
      type: 'image',
      url: poster,
      width: video.videoWidth || undefined,
      height: video.videoHeight || undefined,
    })
  }
  return true
}

function scanVideos(candidates: MediaCandidate[], seenUrls: Set<string>): void {
  const videos = document.querySelectorAll('video')
  let videoIndex = 0
  for (const video of videos) {
    const url = getVideoUrl(video)

    // Skip blob URLs and data URLs
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) {
      if (
        video.currentSrc?.startsWith('blob:') ||
        video.src?.startsWith('blob:')
      ) {
        handleBlobVideo(video, videoIndex, candidates, seenUrls)
      }
      videoIndex++
      continue
    }

    if (seenUrls.has(url)) {
      videoIndex++
      continue
    }
    seenUrls.add(url)

    candidates.push({
      id: `video-${videoIndex}-${Date.now()}`,
      type: 'video',
      url,
      width: video.videoWidth || undefined,
      height: video.videoHeight || undefined,
      poster: video.poster || undefined,
      thumbnailUrl: video.poster || undefined,
    })
    videoIndex++
  }
}

function getCandidates(): GetCandidatesResponse {
  const candidates: MediaCandidate[] = []
  const seenUrls = new Set<string>()

  scanImages(candidates, seenUrls)
  scanBackgroundImages(candidates, seenUrls)
  scanVideos(candidates, seenUrls)
  scanPlatformSpecificMedia(candidates, seenUrls)

  // Build page context
  const pageContext: PageContext = {
    url: window.location.href,
    title: document.title,
    sourcePlatform: detectSourceFromUrl(window.location.href),
  }

  return { candidates, pageContext }
}

function scanInstagramMedia(
  candidates: MediaCandidate[],
  seenUrls: Set<string>,
) {
  try {
    const scripts = document.querySelectorAll('script[type="application/json"]')
    for (const script of scripts) {
      const text = script.textContent || ''
      // Look for video URLs
      const videoMatches = text.matchAll(INSTAGRAM_VIDEO_REGEX)
      for (const match of videoMatches) {
        const url = JSON.parse(`"${match[1]}"`) // Unescape
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          candidates.push({
            id: `ig-video-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'video',
            url,
          })
        }
      }
      // Look for image URLs
      const imageMatches = text.matchAll(INSTAGRAM_IMAGE_REGEX)
      for (const match of imageMatches) {
        const url = JSON.parse(`"${match[1]}"`)
        if (!seenUrls.has(url)) {
          seenUrls.add(url)
          candidates.push({
            id: `ig-image-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'image',
            url,
          })
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse Instagram data:', e)
  }
}

function scanTikTokMedia(candidates: MediaCandidate[], seenUrls: Set<string>) {
  try {
    const scripts = document.querySelectorAll(
      'script[id="__UNIVERSAL_DATA_FOR_REHYDRATION__"]',
    )
    for (const script of scripts) {
      const text = script.textContent || ''
      // TikTok embeds video URLs in their hydration data
      const videoMatches = text.matchAll(TIKTOK_VIDEO_REGEX)
      for (const match of videoMatches) {
        try {
          const url = JSON.parse(`"${match[1]}"`)
          if (!(seenUrls.has(url) || url.startsWith('blob:'))) {
            seenUrls.add(url)
            candidates.push({
              id: `tt-video-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type: 'video',
              url,
            })
          }
        } catch {
          // Skip invalid URLs
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse TikTok data:', e)
  }
}

function scanPlatformSpecificMedia(
  candidates: MediaCandidate[],
  seenUrls: Set<string>,
) {
  const hostname = window.location.hostname

  if (hostname.includes('instagram.com')) {
    scanInstagramMedia(candidates, seenUrls)
  }

  if (hostname.includes('tiktok.com')) {
    scanTikTokMedia(candidates, seenUrls)
  }
}

// Auto-initialize
console.log('[AdStash] Content script loaded')

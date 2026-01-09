// Message types for communication between extension components

export interface MediaCandidate {
  id: string
  type: 'image' | 'video'
  url: string
  thumbnailUrl?: string
  width?: number
  height?: number
  alt?: string
  poster?: string // For videos
}

export interface PageContext {
  url: string
  title: string
  sourcePlatform: string
}

export interface CaptureRequest {
  candidate: MediaCandidate
  pageContext: PageContext
  tagIds?: string[]
}

export interface StorageConfig {
  apiUrl: string
  accessToken: string | null
}

// Message types
export type MessageType =
  | 'GET_CANDIDATES'
  | 'CAPTURE_MEDIA'
  | 'UPLOAD_PROGRESS'
  | 'UPLOAD_COMPLETE'
  | 'UPLOAD_ERROR'

export interface Message<T = unknown> {
  type: MessageType
  payload?: T
}

export interface GetCandidatesResponse {
  candidates: MediaCandidate[]
  pageContext: PageContext
}

export interface UploadProgressPayload {
  candidateId: string
  progress: number
}

export interface UploadCompletePayload {
  candidateId: string
  assetId: string
}

export interface UploadErrorPayload {
  candidateId: string
  error: string
}

// API types
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

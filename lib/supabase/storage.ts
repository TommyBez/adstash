import type { SupabaseClient } from '@supabase/supabase-js'

export const ASSETS_BUCKET = 'assets'
export const PREVIEWS_BUCKET = 'previews'

interface SignedUploadUrlParams {
  bucket: string
  path: string
}

interface SignedDownloadUrlParams {
  bucket: string
  path: string
  expiresIn?: number // seconds, default 3600
}

/**
 * Create a signed URL for uploading a file directly to Supabase Storage.
 * Use this for direct browser → storage uploads.
 */
export async function createSignedUploadUrl(
  supabase: SupabaseClient,
  { bucket, path }: SignedUploadUrlParams,
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path)

  if (error) {
    throw new Error(`Failed to create signed upload URL: ${error.message}`)
  }

  return data
}

/**
 * Create a signed URL for downloading/viewing a file from Supabase Storage.
 */
export async function createSignedDownloadUrl(
  supabase: SupabaseClient,
  { bucket, path, expiresIn = 3600 }: SignedDownloadUrlParams,
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) {
    throw new Error(`Failed to create signed download URL: ${error.message}`)
  }

  return data
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
) {
  const { error } = await supabase.storage.from(bucket).remove([path])

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`)
  }
}

/**
 * Generate a unique storage path for an asset.
 */
export function generateAssetPath(
  userId: string,
  filename: string,
  prefix?: string,
): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  const pathPrefix = prefix ? `${prefix}/` : ''
  return `${pathPrefix}${userId}/${timestamp}-${randomSuffix}-${sanitizedFilename}`
}

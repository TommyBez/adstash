// Chrome storage utilities

import type { StorageConfig } from '../types'

const STORAGE_KEYS = {
  API_URL: 'apiUrl',
  ACCESS_TOKEN: 'accessToken',
} as const

const DEFAULT_API_URL = 'http://localhost:3000'

export async function getConfig(): Promise<StorageConfig> {
  const result = await chrome.storage.sync.get([
    STORAGE_KEYS.API_URL,
    STORAGE_KEYS.ACCESS_TOKEN,
  ])

  return {
    apiUrl: result[STORAGE_KEYS.API_URL] || DEFAULT_API_URL,
    accessToken: result[STORAGE_KEYS.ACCESS_TOKEN] || null,
  }
}

export async function setConfig(config: Partial<StorageConfig>): Promise<void> {
  const updates: Record<string, string> = {}

  if (config.apiUrl !== undefined) {
    updates[STORAGE_KEYS.API_URL] = config.apiUrl
  }

  if (config.accessToken !== undefined) {
    updates[STORAGE_KEYS.ACCESS_TOKEN] = config.accessToken || ''
  }

  await chrome.storage.sync.set(updates)
}

export async function clearConfig(): Promise<void> {
  await chrome.storage.sync.remove([
    STORAGE_KEYS.API_URL,
    STORAGE_KEYS.ACCESS_TOKEN,
  ])
}

export async function isConfigured(): Promise<boolean> {
  const config = await getConfig()
  return !!config.accessToken
}

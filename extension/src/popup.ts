// Popup script

import type {
  CaptureRequest,
  GetCandidatesResponse,
  MediaCandidate,
  Message,
  PageContext,
  UploadCompletePayload,
  UploadErrorPayload,
  UploadProgressPayload,
} from './types'
import { getSourceLabel } from './utils/source-detection'
import { isConfigured } from './utils/storage'

interface CandidateState {
  candidate: MediaCandidate
  status: 'idle' | 'uploading' | 'complete' | 'error'
  progress: number
  error?: string
  selected: boolean
}

let candidates: CandidateState[] = []
let pageContext: PageContext | null = null

// DOM elements
const statusEl = document.getElementById('status')
const candidatesEl = document.getElementById('candidates')
const emptyEl = document.getElementById('empty')
const captureBtn = document.getElementById('capture-btn') as HTMLButtonElement
const selectAllBtn = document.getElementById(
  'select-all-btn',
) as HTMLButtonElement
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement
const sourceEl = document.getElementById('source')

if (!(statusEl && candidatesEl && emptyEl && sourceEl)) {
  throw new Error('Required DOM elements not found')
}

// Initialize
async function init() {
  // Check configuration
  const configured = await isConfigured()
  if (!configured) {
    showNotConfigured()
    return
  }

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    showError('No active tab')
    return
  }

  // Request candidates from content script
  try {
    const response = await chrome.tabs.sendMessage<
      Message,
      GetCandidatesResponse
    >(tab.id, { type: 'GET_CANDIDATES' })

    if (response) {
      pageContext = response.pageContext
      candidates = response.candidates.map((c) => ({
        candidate: c,
        status: 'idle',
        progress: 0,
        selected: false,
      }))

      render()
    } else {
      showError('No media found on this page')
    }
  } catch (_error) {
    // Content script might not be loaded on this page
    showError(
      'Cannot scan this page. Try refreshing or visit a supported site.',
    )
  }
}

function showNotConfigured() {
  statusEl.textContent = 'Not configured'
  statusEl.className = 'status error'
  emptyEl.innerHTML = `
    <p>Please configure your access token to start capturing.</p>
    <button id="open-settings" class="btn btn-primary">Open Settings</button>
  `
  emptyEl.classList.remove('hidden')
  candidatesEl.classList.add('hidden')

  document.getElementById('open-settings')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage()
  })
}

function showError(message: string) {
  statusEl.textContent = 'Error'
  statusEl.className = 'status error'
  emptyEl.innerHTML = `<p>${message}</p>`
  emptyEl.classList.remove('hidden')
  candidatesEl.classList.add('hidden')
}

function updateSourceBadge() {
  if (!pageContext) {
    return
  }
  sourceEl.textContent = getSourceLabel(pageContext.sourcePlatform)
}

function updateStatus() {
  statusEl.textContent = `${candidates.length} item${candidates.length !== 1 ? 's' : ''} found`
  statusEl.className = 'status'
}

function renderEmptyState() {
  emptyEl.innerHTML = '<p>No media found on this page.</p>'
  emptyEl.classList.remove('hidden')
  candidatesEl.classList.add('hidden')
  captureBtn.disabled = true
}

function renderCandidatesList() {
  emptyEl.classList.add('hidden')
  candidatesEl.classList.remove('hidden')
  candidatesEl.innerHTML = candidates
    .map((state, index) => renderCandidate(state, index))
    .join('')
}

function attachCandidateListeners() {
  for (let index = 0; index < candidates.length; index++) {
    const card = document.querySelector(`[data-index="${index}"]`)
    if (!card) {
      continue
    }

    const checkbox = card.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement
    checkbox?.addEventListener('change', () => {
      candidates[index].selected = checkbox.checked
      updateButtons()
    })

    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName !== 'INPUT') {
        candidates[index].selected = !candidates[index].selected
        render()
      }
    })
  }
}

function render() {
  if (!pageContext) {
    return
  }

  updateSourceBadge()
  updateStatus()

  if (candidates.length === 0) {
    renderEmptyState()
    return
  }

  renderCandidatesList()
  attachCandidateListeners()
  updateButtons()
}

function renderCandidate(state: CandidateState, index: number): string {
  const { candidate, status, progress, error, selected } = state
  const isVideo = candidate.type === 'video'

  let statusBadge = ''
  if (status === 'uploading') {
    statusBadge = `<span class="badge uploading">Uploading ${Math.round(progress)}%</span>`
  } else if (status === 'complete') {
    statusBadge = '<span class="badge complete">✓ Saved</span>'
  } else if (status === 'error') {
    statusBadge = `<span class="badge error" title="${error}">✗ Error</span>`
  }

  const thumbnail = candidate.thumbnailUrl || candidate.poster || candidate.url

  return `
    <div class="candidate ${selected ? 'selected' : ''} ${status}" data-index="${index}">
      <div class="candidate-preview">
        ${isVideo ? '<span class="video-badge">Video</span>' : ''}
        <img src="${thumbnail}" alt="" loading="lazy" />
      </div>
      <div class="candidate-info">
        <div class="candidate-meta">
          ${candidate.width && candidate.height ? `${candidate.width}×${candidate.height}` : ''}
        </div>
        ${statusBadge}
      </div>
      <input type="checkbox" ${selected ? 'checked' : ''} ${status !== 'idle' ? 'disabled' : ''} />
    </div>
  `
}

function updateButtons() {
  const selectedCount = candidates.filter(
    (c) => c.selected && c.status === 'idle',
  ).length
  captureBtn.disabled = selectedCount === 0
  captureBtn.textContent =
    selectedCount > 0
      ? `Capture ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`
      : 'Capture'

  const allSelected = candidates.every((c) => c.selected || c.status !== 'idle')
  selectAllBtn.textContent = allSelected ? 'Deselect All' : 'Select All'
}

// Capture selected items
async function captureSelected() {
  if (!pageContext) {
    return
  }

  const toCapture = candidates.filter((c) => c.selected && c.status === 'idle')
  if (toCapture.length === 0) {
    return
  }

  for (const state of toCapture) {
    state.status = 'uploading'
    state.progress = 0
  }
  render()

  // Send capture requests to background script
  for (const state of toCapture) {
    const request: CaptureRequest = {
      candidate: state.candidate,
      pageContext,
    }

    try {
      await chrome.runtime.sendMessage<Message>({
        type: 'CAPTURE_MEDIA',
        payload: request,
      })
    } catch (error) {
      state.status = 'error'
      state.error = error instanceof Error ? error.message : 'Unknown error'
      render()
    }
  }
}

// Listen for upload progress/completion
chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === 'UPLOAD_PROGRESS') {
    const payload = message.payload as UploadProgressPayload
    const state = candidates.find((c) => c.candidate.id === payload.candidateId)
    if (state) {
      state.progress = payload.progress
      render()
    }
  } else if (message.type === 'UPLOAD_COMPLETE') {
    const payload = message.payload as UploadCompletePayload
    const state = candidates.find((c) => c.candidate.id === payload.candidateId)
    if (state) {
      state.status = 'complete'
      state.progress = 100
      render()
    }
  } else if (message.type === 'UPLOAD_ERROR') {
    const payload = message.payload as UploadErrorPayload
    const state = candidates.find((c) => c.candidate.id === payload.candidateId)
    if (state) {
      state.status = 'error'
      state.error = payload.error
      render()
    }
  }
})

// Button handlers
captureBtn.addEventListener('click', captureSelected)

selectAllBtn.addEventListener('click', () => {
  const allSelected = candidates.every((c) => c.selected || c.status !== 'idle')
  for (const c of candidates) {
    if (c.status === 'idle') {
      c.selected = !allSelected
    }
  }
  render()
})

settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})

// Initialize
init()

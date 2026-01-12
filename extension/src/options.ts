// Options page script

import { getConfig, setConfig } from './utils/storage'

const apiUrlInput = document.getElementById('api-url') as HTMLInputElement
const tokenInput = document.getElementById('token') as HTMLInputElement
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement
const statusEl = document.getElementById('status')
const testBtn = document.getElementById('test-btn') as HTMLButtonElement

if (!statusEl) {
  throw new Error('Status element not found')
}

// Load current config
async function loadConfig() {
  const config = await getConfig()
  apiUrlInput.value = config.apiUrl
  tokenInput.value = config.accessToken || ''
}

// Save config
async function saveConfig() {
  const apiUrl = apiUrlInput.value.trim()
  const accessToken = tokenInput.value.trim()

  if (!apiUrl) {
    showStatus('API URL is required', 'error')
    return
  }

  try {
    new URL(apiUrl)
  } catch {
    showStatus('Invalid API URL', 'error')
    return
  }

  await setConfig({ apiUrl, accessToken })
  showStatus('Settings saved!', 'success')
}

// Test connection
async function testConnection() {
  const apiUrl = apiUrlInput.value.trim()
  const accessToken = tokenInput.value.trim()

  if (!(apiUrl && accessToken)) {
    showStatus('Please enter API URL and access token', 'error')
    return
  }

  testBtn.disabled = true
  testBtn.textContent = 'Testing...'

  try {
    const response = await fetch(`${apiUrl}/api/extension/verify`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (response.ok) {
      showStatus('Connection successful!', 'success')
    } else if (response.status === 401) {
      showStatus('Invalid access token', 'error')
    } else {
      showStatus(`Connection failed: ${response.status}`, 'error')
    }
  } catch (_error) {
    showStatus('Connection failed. Check the API URL.', 'error')
  } finally {
    testBtn.disabled = false
    testBtn.textContent = 'Test Connection'
  }
}

function showStatus(message: string, type: 'success' | 'error') {
  if (!statusEl) {
    return
  }

  statusEl.textContent = message
  statusEl.className = `status ${type}`
  statusEl.classList.remove('hidden')

  setTimeout(() => {
    statusEl.classList.add('hidden')
  }, 3000)
}

// Event listeners
saveBtn.addEventListener('click', saveConfig)
testBtn.addEventListener('click', testConnection)

// Initialize
loadConfig()

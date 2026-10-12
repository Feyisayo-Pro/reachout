// sidepanel.js — ReachOut side panel

const LIMITS = { connection: 300, message: 900 }

const $ = id => document.getElementById(id)
let recruiter = null

// ── settings (local only) ───────────────────────────────────────────────────
async function loadSettings() {
  const s = await chrome.storage.local.get(['token', 'apiBase', 'background'])
  $('token').value      = s.token      || ''
  $('apiBase').value    = s.apiBase    || ''
  $('background').value = s.background || ''
  // Nudge the user to fill settings if they're empty
  if (!s.token || !s.apiBase) $('settings').open = true
  return s
}

$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({
    token:      $('token').value.trim(),
    apiBase:    $('apiBase').value.trim().replace(/\/+$/, ''),
    background: $('background').value.trim(),
  })
  $('saved').classList.remove('hidden')
  setTimeout(() => $('saved').classList.add('hidden'), 1800)
})

// ── render detected recruiter ───────────────────────────────────────────────
function render(r) {
  recruiter = r
  if (!r || !r.name) {
    $('main').classList.add('hidden')
    $('empty').classList.remove('hidden')
    return
  }
  $('empty').classList.add('hidden')
  $('main').classList.remove('hidden')
  $('who').textContent = r.name
  const bits = [r.headline, r.company, r.location].filter(Boolean)
  $('meta').textContent = bits.join(' · ').slice(0, 180)
}

async function pull() {
  const s = await chrome.storage.session.get(['currentRecruiter'])
  if (s?.currentRecruiter) { render(s.currentRecruiter); return }
  // fall back to asking the active tab directly
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  chrome.tabs.sendMessage(tab.id, { type: 'GET_RECRUITER' }, resp => {
    if (chrome.runtime.lastError) return
    if (resp) render(resp)
  })
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'session' && changes.currentRecruiter?.newValue) {
    render(changes.currentRecruiter.newValue)
  }
})

// ── draft ───────────────────────────────────────────────────────────────────
function showError(msg) {
  $('err').textContent = msg
  $('err').classList.remove('hidden')
}

async function draft() {
  $('err').classList.add('hidden')
  $('out').classList.add('hidden')

  const s = await chrome.storage.local.get(['token', 'apiBase', 'background'])
  if (!s.apiBase || !s.token) {
    $('settings').open = true
    showError('Add your API base URL and token in Settings first.')
    return
  }
  if (!recruiter) { showError('No recruiter detected on this page.'); return }

  const messageType = $('type').value
  $('draft').disabled = true
  $('draft').textContent = 'Drafting…'

  try {
    const res = await fetch(`${s.apiBase}/api/draft`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.token}` },
      body: JSON.stringify({
        recruiterName:     recruiter.name,
        recruiterHeadline: recruiter.headline,
        recruiterCompany:  recruiter.company,
        recruiterAbout:    recruiter.about,
        postText:          recruiter.postText,
        roleOfInterest:    $('role').value.trim(),
        userBackground:    s.background || '',
        messageType,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`)

    const text  = data.draft || ''
    const limit = LIMITS[messageType] || LIMITS.connection
    $('draftText').textContent = text
    $('count').textContent = `${text.length} / ${limit} characters`
    $('count').classList.toggle('over', text.length > limit)
    $('out').classList.remove('hidden')
  } catch (e) {
    showError(e.message || 'Could not draft the message.')
  } finally {
    $('draft').disabled = false
    $('draft').textContent = 'Draft message'
  }
}

$('draft').addEventListener('click', draft)
$('regen').addEventListener('click', draft)

$('copy').addEventListener('click', () => {
  navigator.clipboard.writeText($('draftText').textContent || '').then(() => {
    $('copy').textContent = 'Copied'
    setTimeout(() => { $('copy').textContent = 'Copy' }, 1600)
  })
})

loadSettings()
pull()

// sidepanel.js — thin client. Profile, CV and history all live in the user's
// ReachOut account; the extension only holds a device key and the API URL.

const LIMITS = { connection: 300, message: 900 }
const $ = id => document.getElementById(id)
let recruiter = null

const cfg = () => chrome.storage.local.get(['token', 'apiBase'])

async function call(path, opts = {}) {
  const { token, apiBase } = await cfg()
  if (!token || !apiBase) throw new Error('Add your ReachOut URL and device key under Connection first.')
  const res = await fetch(apiBase + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`)
  return data
}

async function checkAccount() {
  try {
    const me = await call('/api/me')
    $('acct').textContent = me.hasCv
      ? `Connected${me.name ? ' as ' + me.name : ''}. Profile ready.`
      : 'Connected, but you have not added a CV yet. Add it on the ReachOut website.'
    return true
  } catch (e) { $('acct').textContent = e.message; return false }
}

async function loadSettings() {
  const s = await cfg()
  $('apiBase').value = s.apiBase || ''
  $('token').value   = s.token   || ''
  if (!s.token || !s.apiBase) $('settings').open = true
  else checkAccount()
}

$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({
    apiBase: $('apiBase').value.trim().replace(/\/+$/, ''),
    token:   $('token').value.trim(),
  })
  $('saved').classList.remove('hidden')
  $('saved').textContent = 'Checking...'
  $('saved').textContent = (await checkAccount()) ? 'Connected.' : 'Saved, but the connection failed.'
})

function render(r) {
  recruiter = r
  const ok = r && r.name
  $('empty').classList.toggle('hidden', !!ok)
  $('main').classList.toggle('hidden', !ok)
  if (!ok) return
  $('who').textContent = r.name
  $('meta').textContent = [r.headline, r.company, r.location].filter(Boolean).join(' · ').slice(0, 180)
}

async function pull() {
  const s = await chrome.storage.session.get(['currentRecruiter'])
  if (s?.currentRecruiter) return render(s.currentRecruiter)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return
  chrome.tabs.sendMessage(tab.id, { type: 'GET_RECRUITER' }, resp => {
    if (!chrome.runtime.lastError && resp) render(resp)
  })
}

chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'session' && ch.currentRecruiter?.newValue) render(ch.currentRecruiter.newValue)
})

function showError(m) { $('err').textContent = m; $('err').classList.remove('hidden') }

async function draft() {
  $('err').classList.add('hidden'); $('out').classList.add('hidden')
  if (!recruiter) return showError('No recruiter detected on this page.')
  const messageType = $('type').value
  $('draft').disabled = true; $('draft').textContent = 'Drafting…'
  try {
    const d = await call('/api/draft', {
      method: 'POST',
      body: JSON.stringify({
        recruiterName: recruiter.name, recruiterHeadline: recruiter.headline,
        recruiterCompany: recruiter.company, recruiterLocation: recruiter.location,
        recruiterAbout: recruiter.about, postText: recruiter.postText,
        profileUrl: recruiter.profileUrl, roleOfInterest: $('role').value.trim(), messageType,
      }),
    })
    const limit = LIMITS[messageType] || LIMITS.connection
    $('draftText').textContent = d.draft
    $('count').textContent = `${d.draft.length} / ${limit} characters`
    $('count').classList.toggle('over', d.draft.length > limit)
    $('savedNote').textContent = 'Saved to your outreach history. Read it before you send.'
    $('out').classList.remove('hidden')
  } catch (e) {
    if (/key|URL/i.test(e.message)) $('settings').open = true
    showError(e.message)
  } finally { $('draft').disabled = false; $('draft').textContent = 'Draft message' }
}

$('draft').addEventListener('click', draft)
$('regen').addEventListener('click', draft)
$('copy').addEventListener('click', () =>
  navigator.clipboard.writeText($('draftText').textContent || '').then(() => {
    $('copy').textContent = 'Copied'; setTimeout(() => { $('copy').textContent = 'Copy' }, 1600)
  }))

loadSettings(); pull()

// Shared server helpers: hashing, CORS, auth for web sessions and extension
// device keys, and the persisted daily draft cap.
import crypto from 'node:crypto'
import { adminAuth, adminDb, FieldValue } from './admin.js'

export const sha256 = s => crypto.createHash('sha256').update(s, 'utf8').digest('hex')
export const newKey = () => 'ro_' + crypto.randomBytes(24).toString('hex')

export function cap(v, max) {
  const s = typeof v === 'string' ? v : ''
  return s.length > max ? s.slice(0, max) : s
}

// CORS is granted ONLY to chrome-extension:// origins, never "*". Auth is by
// bearer key, not cookies, so this is about not exposing the API to arbitrary
// pages rather than about CSRF.
export function corsHeaders(req) {
  const origin = req.headers.get('origin') || ''
  const h = { Vary: 'Origin' }
  if (origin.startsWith('chrome-extension://')) {
    h['Access-Control-Allow-Origin']  = origin
    h['Access-Control-Allow-Headers'] = 'authorization, content-type'
    h['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    h['Access-Control-Max-Age']       = '600'
  }
  return h
}

export const preflight = req => new Response(null, { status: 204, headers: corsHeaders(req) })
export const json = (req, body, status = 200) =>
  Response.json(body, { status, headers: corsHeaders(req) })

// Client-facing errors are limited to ones we threw deliberately (< 500).
// Anything else is logged server-side and reduced to a generic message.
export function fail(req, err) {
  const status = err?.status || 500
  if (status >= 500) { console.error('[reachout]', err); return json(req, { message: 'Something went wrong.' }, 500) }
  return json(req, { message: err.message || 'Request failed.' }, status)
}

function bearer(req) {
  const h = req.headers.get('authorization') || ''
  return h.startsWith('Bearer ') ? h.slice(7).trim() : ''
}

/** Web dashboard calls: verifies a Firebase ID token. Returns the uid. */
export async function requireUser(req) {
  const token = bearer(req)
  if (!token) throw { status: 401, message: 'Sign in required.' }
  const auth = adminAuth()                       // config errors surface as 500, not 401
  try { return (await auth.verifyIdToken(token)).uid }
  catch { throw { status: 401, message: 'Session expired. Sign in again.' } }
}

/** Extension calls: resolves a device key to its owner. Revoked keys fail. */
export async function requireDevice(req) {
  const key = bearer(req)
  if (!key.startsWith('ro_')) throw { status: 401, message: 'Invalid device key.' }
  const db   = adminDb()
  const ref  = db.collection('deviceKeys').doc(sha256(key))   // direct lookup by hash
  const snap = await ref.get()
  if (!snap.exists || snap.data().revokedAt) {
    throw { status: 401, message: 'Invalid or revoked device key.' }
  }
  ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {})
  return { uid: snap.data().uid, db }
}

/** Atomically counts one draft against today's cap. Throws 429 when exceeded. */
export async function countDraft(db, uid) {
  const limit = Number(process.env.DAILY_LIMIT || 40)
  const ref = db.doc(`users/${uid}/usage/${new Date().toISOString().slice(0, 10)}`)
  await db.runTransaction(async tx => {
    const s = await tx.get(ref)
    const n = (s.exists ? s.data().count : 0) + 1
    if (n > limit) throw { status: 429, message: `Daily limit of ${limit} drafts reached.` }
    tx.set(ref, { count: n }, { merge: true })
  })
}

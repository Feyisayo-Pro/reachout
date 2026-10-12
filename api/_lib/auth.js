// api/_lib/auth.js — self-contained auth + usage limiting.
//
// Deliberately simple: tokens are issued out-of-band (see README) and stored
// hashed in the TOKENS env var. No database, no user accounts, no third-party
// auth dependency. Enough for a single user or a small private group, and a
// clean seam to swap for a real datastore later.

import crypto from 'node:crypto'

const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 40)

// In-memory counter. Serverless instances are ephemeral, so this throttles
// bursts rather than enforcing a hard global cap. Swap for Redis/KV if a
// strict limit is ever needed.
const usage = new Map()

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex')
}

/** Constant-time compare that tolerates unequal lengths. */
function safeEqual(a, b) {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

/**
 * Verifies the bearer token and applies a per-token daily cap.
 * Throws { status, message } on failure.
 * @returns {string} a short, non-reversible token id for logging
 */
export function verify(req) {
  const header = req.headers?.authorization || ''
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw { status: 401, message: 'Missing API token.' }

  // TOKENS is a comma-separated list of sha256 hashes of valid tokens.
  const allowed = (process.env.TOKENS || '')
    .split(',').map(s => s.trim()).filter(Boolean)
  if (!allowed.length) {
    throw { status: 500, message: 'Server has no TOKENS configured.' }
  }

  const hash = sha256(token)
  if (!allowed.some(a => safeEqual(a, hash))) {
    throw { status: 401, message: 'Invalid API token.' }
  }

  const day = new Date().toISOString().slice(0, 10)
  const key = `${hash.slice(0, 12)}:${day}`
  const n   = (usage.get(key) || 0) + 1
  usage.set(key, n)
  if (n > DAILY_LIMIT) {
    throw { status: 429, message: `Daily limit of ${DAILY_LIMIT} drafts reached.` }
  }

  return hash.slice(0, 12)
}

export function handleError(res, err) {
  const status  = err?.status || 500
  const message = err?.message || 'Something went wrong.'
  if (status >= 500) console.error('[reachout]', err)
  return res.status(status).json({ message })
}

export function cap(str, max) {
  if (!str) return ''
  return String(str).length > max ? String(str).slice(0, max) + '…' : String(str)
}

import { adminDb, FieldValue } from '../../../lib/admin.js'
import { requireUser, newKey, sha256, json, fail, cap } from '../../../lib/server.js'

const MAX_ACTIVE_KEYS = 5

export async function GET(req) {
  try {
    const uid  = await requireUser(req)
    const snap = await adminDb().collection('deviceKeys').where('uid', '==', uid).get()
    const keys = snap.docs.map(d => {
      const x = d.data()
      return {
        id: d.id.slice(0, 12),                       // non-secret handle; never the full hash
        label: x.label || '',
        createdAt:  x.createdAt?.toMillis?.()  ?? null,
        lastUsedAt: x.lastUsedAt?.toMillis?.() ?? null,
        revoked: !!x.revokedAt,
      }
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return json(req, { keys })
  } catch (e) { return fail(req, e) }
}

export async function POST(req) {
  try {
    const uid = await requireUser(req)
    const db  = adminDb()
    const body  = await req.json().catch(() => ({}))
    const label = cap(body.label, 60).trim() || 'Chrome extension'

    const existing = await db.collection('deviceKeys').where('uid', '==', uid).get()
    if (existing.docs.filter(d => !d.data().revokedAt).length >= MAX_ACTIVE_KEYS) {
      throw { status: 400, message: `You can have up to ${MAX_ACTIVE_KEYS} active keys. Revoke one first.` }
    }

    const key  = newKey()
    const hash = sha256(key)
    await db.collection('deviceKeys').doc(hash).set({
      uid, label, createdAt: FieldValue.serverTimestamp(), lastUsedAt: null, revokedAt: null,
    })
    // The raw key is returned exactly once. Only its hash is stored.
    return json(req, { key, id: hash.slice(0, 12), label }, 201)
  } catch (e) { return fail(req, e) }
}

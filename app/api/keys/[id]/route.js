import { adminDb, FieldValue } from '../../../../lib/admin.js'
import { requireUser, json, fail } from '../../../../lib/server.js'

export async function DELETE(req, { params }) {
  try {
    const uid  = await requireUser(req)
    const { id } = await params
    const db   = adminDb()
    const snap = await db.collection('deviceKeys').where('uid', '==', uid).get()
    // Scoped to the caller's own keys, so another user's handle can never match.
    const doc  = snap.docs.find(d => d.id.startsWith(id) && id.length >= 8)
    if (!doc) throw { status: 404, message: 'Key not found.' }
    await doc.ref.update({ revokedAt: FieldValue.serverTimestamp() })
    return json(req, { ok: true })
  } catch (e) { return fail(req, e) }
}

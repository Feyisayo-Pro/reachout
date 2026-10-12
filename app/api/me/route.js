import { requireDevice, json, fail, preflight } from '../../../lib/server.js'
export const OPTIONS = preflight

// Lets the extension confirm its key works and the profile is ready.
export async function GET(req) {
  try {
    const { uid, db } = await requireDevice(req)
    const p = (await db.doc(`users/${uid}/profile/main`).get()).data() || {}
    return json(req, { name: p.fullName || '', hasCv: !!p.cvText, targetRoles: p.targetRoles || [] })
  } catch (e) { return fail(req, e) }
}

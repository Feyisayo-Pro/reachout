// Server-only Firebase Admin. Initialised lazily so a build without the
// service account still succeeds. Never import this from client code.
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

function app() {
  if (getApps().length) return getApps()[0]
  const projectId   = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    throw { status: 500, message: 'Server is not configured.' }
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

export const adminAuth = () => getAuth(app())
export const adminDb   = () => getFirestore(app())
export { FieldValue }

// Client-side Firebase init. These NEXT_PUBLIC_* values are identifiers, not
// secrets: they are shipped to every browser by design. Access control comes
// from firestore.rules, not from hiding these.
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const config = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId)

const app = firebaseConfigured
  ? (getApps()[0] || initializeApp(config))
  : null

export const auth = app ? getAuth(app) : null
export const db   = app ? getFirestore(app) : null

// Authenticated fetch to our own API using the signed-in user's ID token.
import { auth } from './firebase'

export async function apiFetch(path, opts = {}) {
  const token = await auth.currentUser.getIdToken()
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`)
  return data
}

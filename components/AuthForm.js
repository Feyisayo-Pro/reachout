'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, updateProfile, sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const FIELD = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

// Map Firebase error codes to messages that do not reveal whether an
// account exists (avoids user enumeration on the login path).
function friendly(err, mode) {
  const c = err?.code || ''
  if (mode === 'login' && /user-not-found|wrong-password|invalid-credential|invalid-email/.test(c))
    return 'Email or password is incorrect.'
  if (c === 'auth/email-already-in-use') return 'Could not create that account.'
  if (c === 'auth/weak-password') return 'Use a password of at least 8 characters.'
  if (c === 'auth/too-many-requests') return 'Too many attempts. Wait a minute and try again.'
  return 'Something went wrong. Try again.'
}

export default function AuthForm({ mode }) {
  const router = useRouter()
  const signup = mode === 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      if (signup) {
        if (password.length < 8) throw { code: 'auth/weak-password' }
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() })
        await setDoc(doc(db, 'users', cred.user.uid), {
          email: cred.user.email, displayName: name.trim(), createdAt: serverTimestamp(),
        })
        sendEmailVerification(cred.user).catch(() => {})
        router.replace('/profile')
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password)
        router.replace('/dashboard')
      }
    } catch (err) {
      setError(friendly(err, mode))
    } finally { setBusy(false) }
  }

  async function reset() {
    setError(''); setInfo('')
    if (!email.trim()) { setError('Enter your email first.'); return }
    // Always show the same message, whether or not the account exists.
    sendPasswordResetEmail(auth, email.trim()).catch(() => {})
    setInfo('If that account exists, a reset link is on its way.')
  }

  return (
    <main className="mx-auto mt-16 w-full max-w-sm px-4">
      <h1 className="text-2xl font-semibold">ReachOut</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">
        {signup ? 'Create your account.' : 'Log in to your account.'}
      </p>
      <form onSubmit={submit} className="space-y-3">
        {signup && (
          <input className={FIELD} placeholder="Your name" value={name}
                 onChange={e => setName(e.target.value)} autoComplete="name" />
        )}
        <input className={FIELD} type="email" placeholder="Email" required value={email}
               onChange={e => setEmail(e.target.value)} autoComplete="email" />
        <input className={FIELD} type="password" placeholder="Password" required value={password}
               onChange={e => setPassword(e.target.value)}
               autoComplete={signup ? 'new-password' : 'current-password'} />
        <button disabled={busy}
                className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy ? 'Please wait...' : signup ? 'Create account' : 'Log in'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {info  && <p className="text-sm text-emerald-700">{info}</p>}
      </form>
      <div className="mt-4 flex justify-between text-sm text-gray-500">
        {signup
          ? <Link className="hover:underline" href="/login">Have an account? Log in</Link>
          : <Link className="hover:underline" href="/signup">Create an account</Link>}
        {!signup && <button type="button" onClick={reset} className="hover:underline">Forgot password</button>}
      </div>
    </main>
  )
}

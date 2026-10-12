'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, firebaseConfigured } from './firebase'

const Ctx = createContext({ user: null, loading: true })

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) { setLoading(false); return }
    return onAuthStateChanged(auth, u => { setUser(u); setLoading(false) })
  }, [])

  if (!firebaseConfigured) {
    return (
      <div className="mx-auto max-w-lg p-8 text-sm">
        <h1 className="mb-2 text-lg font-semibold">Firebase is not configured</h1>
        <p className="text-gray-600">
          Set the <code>NEXT_PUBLIC_FIREBASE_*</code> variables (see <code>.env.example</code>) and restart.
        </p>
      </div>
    )
  }
  return <Ctx.Provider value={{ user, loading }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

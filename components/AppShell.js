'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useAuth } from '../lib/AuthContext'

// Wraps every signed-in page: redirects to /login when logged out.
export default function AppShell({ children }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const path = usePathname()

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading, router])
  if (loading || !user) return null

  const tab = (href, label) => (
    <Link href={href}
          className={`rounded-md px-3 py-1.5 text-sm ${path === href ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>
      {label}
    </Link>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <nav className="flex items-center gap-1">
          <span className="mr-3 text-lg font-semibold">ReachOut</span>
          {tab('/dashboard', 'Outreach')}
          {tab('/profile', 'Profile')}
        </nav>
        <button onClick={() => signOut(auth).then(() => router.replace('/login'))}
                className="text-sm text-gray-500 hover:text-gray-800">Log out</button>
      </header>
      {!user.emailVerified && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Your email is not verified yet. Check your inbox for the verification link.
        </p>
      )}
      {children}
    </div>
  )
}

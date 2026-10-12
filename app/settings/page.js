'use client'
import { useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import AppShell from '../../components/AppShell'

const FIELD = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const when = ms => (ms ? new Date(ms).toLocaleString() : 'never')

export default function SettingsPage() { return <AppShell><Settings /></AppShell> }

function Settings() {
  const [keys, setKeys]   = useState([])
  const [label, setLabel] = useState('Chrome on this Mac')
  const [fresh, setFresh] = useState(null)   // raw key, shown once
  const [copied, setCopied] = useState(false)
  const [busy, setBusy]   = useState(false)
  const [err, setErr]     = useState('')

  const load = () => apiFetch('/api/keys').then(d => setKeys(d.keys)).catch(e => setErr(e.message))
  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault(); setBusy(true); setErr(''); setFresh(null)
    try {
      const d = await apiFetch('/api/keys', { method: 'POST', body: JSON.stringify({ label }) })
      setFresh(d.key); load()
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  async function revoke(id) {
    if (!confirm('Revoke this key? The extension using it will stop working immediately.')) return
    try { await apiFetch(`/api/keys/${id}`, { method: 'DELETE' }); load() }
    catch (e) { setErr(e.message) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Connect the extension</h1>
        <p className="text-sm text-gray-500">
          Create a device key, paste it into the ReachOut extension, and every draft is saved to your account.
        </p>
      </div>

      <form onSubmit={create} className="flex gap-2">
        <input className={FIELD + ' flex-1'} value={label} onChange={e => setLabel(e.target.value)}
               maxLength={60} placeholder="Label, e.g. Chrome on MacBook" />
        <button disabled={busy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {busy ? 'Creating...' : 'Create key'}
        </button>
      </form>

      {fresh && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-medium text-amber-900">Copy this key now. It will not be shown again.</p>
          <div className="flex gap-2">
            <code className="flex-1 break-all rounded bg-white px-2 py-2 text-xs">{fresh}</code>
            <button onClick={() => navigator.clipboard.writeText(fresh).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })}
                    className="rounded-lg border border-amber-300 bg-white px-3 text-sm">{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <p className="mt-2 text-xs text-amber-800">
            Only a one-way hash is stored. If you lose it, revoke it and create another.
          </p>
        </div>
      )}
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {keys.length === 0 && <p className="p-4 text-sm text-gray-500">No keys yet.</p>}
        {keys.map(k => (
          <div key={k.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <div className="font-medium">{k.label} {k.revoked && <span className="ml-1 text-xs text-red-600">revoked</span>}</div>
              <div className="text-xs text-gray-500">Created {when(k.createdAt)} · Last used {when(k.lastUsedAt)}</div>
            </div>
            {!k.revoked && <button onClick={() => revoke(k.id)} className="text-xs text-red-600 hover:underline">Revoke</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../lib/AuthContext'
import AppShell from '../../components/AppShell'

const STATUSES = [['drafted', 'Drafted'], ['sent', 'Sent'], ['replied', 'Replied'], ['no_response', 'No response'], ['rejected', 'Rejected']]
const BADGE = { drafted: 'bg-gray-100 text-gray-700', sent: 'bg-blue-50 text-blue-700', replied: 'bg-emerald-50 text-emerald-700', no_response: 'bg-amber-50 text-amber-700', rejected: 'bg-red-50 text-red-700' }

export default function Dashboard() { return <AppShell><Outreach /></AppShell> }

function Outreach() {
  const { user } = useAuth()
  const [rows, setRows]   = useState(null)
  const [filter, setFilter] = useState('all')
  const [err, setErr]     = useState('')
  const col = collection(db, 'users', user.uid, 'outreach')

  useEffect(() => {
    getDocs(query(col, orderBy('createdAt', 'desc'), limit(100)))
      .then(s => setRows(s.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setErr('Could not load your outreach.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function setStatus(r, status) {
    const patch = { status, ...(status === 'sent' && !r.sentAt ? { sentAt: serverTimestamp() } : {}) }
    try {
      await updateDoc(doc(db, 'users', user.uid, 'outreach', r.id), patch)
      setRows(rs => rs.map(x => x.id === r.id ? { ...x, status, sentAt: x.sentAt || (status === 'sent' ? { seconds: Date.now() / 1000 } : null) } : x))
    } catch { setErr('Could not update that row.') }
  }

  async function remove(r) {
    if (!confirm(`Delete the record for ${r.recruiterName || 'this recruiter'}?`)) return
    try { await deleteDoc(doc(db, 'users', user.uid, 'outreach', r.id)); setRows(rs => rs.filter(x => x.id !== r.id)) }
    catch { setErr('Could not delete that row.') }
  }

  const shown = (rows || []).filter(r => filter === 'all' || r.status === filter)
  const counts = (rows || []).reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {})

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Outreach</h1>
          <p className="text-sm text-gray-500">Everyone you have drafted a message for.</p>
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm">
          <option value="all">All ({rows?.length || 0})</option>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l} ({counts[v] || 0})</option>)}
        </select>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {rows === null && !err && <p className="text-sm text-gray-500">Loading...</p>}
      {rows && rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
          Nothing yet. Connect the extension in Settings, open a recruiter on LinkedIn, and draft a message.
        </p>
      )}
      {shown.map(r => (
        <article key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium">{r.recruiterName || 'Unknown'}</div>
              <div className="truncate text-xs text-gray-500">
                {[r.recruiterHeadline, r.recruiterCompany].filter(Boolean).join(' · ')}
              </div>
              <div className="mt-0.5 text-xs text-gray-400">
                {r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : ''}
                {' · '}{r.messageType === 'connection' ? 'Connection note' : 'Message'}
                {r.roleOfInterest ? ` · ${r.roleOfInterest}` : ''}
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${BADGE[r.status] || BADGE.drafted}`}>
              {(STATUSES.find(s => s[0] === r.status) || STATUSES[0])[1]}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm">{r.draftText}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <select value={r.status} onChange={e => setStatus(r, e.target.value)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1">
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={() => navigator.clipboard.writeText(r.draftText)}
                    className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-50">Copy</button>
            {r.recruiterProfileUrl && (
              <a href={r.recruiterProfileUrl} target="_blank" rel="noreferrer"
                 className="rounded-md border border-gray-300 px-2 py-1 hover:bg-gray-50">Open LinkedIn</a>
            )}
            <button onClick={() => remove(r)} className="ml-auto text-red-600 hover:underline">Delete</button>
          </div>
        </article>
      ))}
    </div>
  )
}

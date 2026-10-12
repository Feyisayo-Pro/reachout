'use client'
import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../lib/AuthContext'
import { parseCV, MAX_CV_CHARS } from '../../lib/parseCV'
import AppShell from '../../components/AppShell'

const FIELD = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
const LABEL = 'mb-1 block text-sm font-medium text-gray-700'

export default function ProfilePage() {
  return <AppShell><Profile /></AppShell>
}

function Profile() {
  const { user } = useAuth()
  const ref = doc(db, 'users', user.uid, 'profile', 'main')

  const [f, setF] = useState({
    fullName: user.displayName || '', headline: '', location: '', workAuth: '',
    targetRoles: '', cvText: '', cvFileName: '',
  })
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState({ kind: '', text: '' })
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    getDoc(ref).then(s => {
      if (!s.exists()) return
      const d = s.data()
      setF(p => ({ ...p, ...d, targetRoles: (d.targetRoles || []).join(', ') }))
    }).catch(() => setMsg({ kind: 'err', text: 'Could not load your profile.' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true); setMsg({ kind: '', text: '' })
    try {
      const text = await parseCV(file)
      setF(p => ({ ...p, cvText: text, cvFileName: file.name }))
      setMsg({ kind: 'ok', text: `Read ${text.length.toLocaleString()} characters from ${file.name}. Review below, then save.` })
    } catch (err) {
      setMsg({ kind: 'err', text: err.message || 'Could not read that file.' })
    } finally { setParsing(false); e.target.value = '' }
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true); setMsg({ kind: '', text: '' })
    try {
      await setDoc(ref, {
        fullName:    f.fullName.trim().slice(0, 200),
        headline:    f.headline.trim().slice(0, 300),
        location:    f.location.trim().slice(0, 200),
        workAuth:    f.workAuth.trim().slice(0, 300),
        targetRoles: f.targetRoles.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10),
        cvText:      f.cvText.slice(0, MAX_CV_CHARS),
        cvFileName:  f.cvFileName || '',
        cvUpdatedAt: serverTimestamp(),
      })
      setMsg({ kind: 'ok', text: 'Saved.' })
    } catch {
      setMsg({ kind: 'err', text: 'Could not save. Check your connection and try again.' })
    } finally { setSaving(false) }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Your profile</h1>
        <p className="text-sm text-gray-500">
          Every draft is grounded in this. Nothing outside it is ever claimed about you.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={LABEL}>Full name</label>
          <input className={FIELD} value={f.fullName} onChange={set('fullName')} maxLength={200} /></div>
        <div><label className={LABEL}>Location</label>
          <input className={FIELD} value={f.location} onChange={set('location')} placeholder="e.g. Lagos, Nigeria" maxLength={200} /></div>
      </div>

      <div><label className={LABEL}>Headline</label>
        <input className={FIELD} value={f.headline} onChange={set('headline')}
               placeholder="e.g. AI Automation Engineer, n8n, LLM integrations" maxLength={300} /></div>

      <div><label className={LABEL}>Target roles (comma separated)</label>
        <input className={FIELD} value={f.targetRoles} onChange={set('targetRoles')}
               placeholder="AI Automation Engineer, Workflow Automation Engineer" /></div>

      <div>
        <label className={LABEL}>Work authorisation / eligibility (optional)</label>
        <input className={FIELD} value={f.workAuth} onChange={set('workAuth')} maxLength={300}
               placeholder="e.g. Remote contractor based in Nigeria. No US work authorisation." />
        <p className="mt-1 text-xs text-gray-400">
          Written by you, used verbatim. The model is never allowed to guess this.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4">
        <label className={LABEL}>Upload your CV (PDF or DOCX)</label>
        <input type="file" accept=".pdf,.docx" onChange={onFile}
               className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100" />
        <p className="mt-2 text-xs text-gray-400">
          The file is read in your browser. Only the extracted text is saved; the document itself is never uploaded.
        </p>
        {parsing && <p className="mt-2 text-xs text-gray-500">Reading file...</p>}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className={LABEL}>CV text</label>
          <span className="text-xs text-gray-400">
            {f.cvFileName && `${f.cvFileName} · `}{f.cvText.length.toLocaleString()} / {MAX_CV_CHARS.toLocaleString()}
          </span>
        </div>
        <textarea className={FIELD + ' font-mono text-xs'} rows={14} value={f.cvText}
                  onChange={set('cvText')} maxLength={MAX_CV_CHARS}
                  placeholder="Upload a file above, or paste your CV text here." />
      </div>

      <div className="flex items-center gap-3">
        <button disabled={saving || parsing}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save profile'}
        </button>
        {msg.text && (
          <span className={`text-sm ${msg.kind === 'err' ? 'text-red-600' : 'text-emerald-700'}`}>{msg.text}</span>
        )}
      </div>
    </form>
  )
}

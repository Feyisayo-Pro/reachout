'use client'
import AppShell from '../../components/AppShell'

export default function Dashboard() {
  return (
    <AppShell>
      <h1 className="text-xl font-semibold">Outreach</h1>
      <p className="mt-2 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        Your outreach history will appear here once the extension is connected (Phase 2 and 3).
        For now, set up your profile so every draft is grounded in your real background.
      </p>
    </AppShell>
  )
}

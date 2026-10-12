import './globals.css'
import { AuthProvider } from '../lib/AuthContext'

export const metadata = {
  title: 'ReachOut',
  description: 'Draft tailored LinkedIn outreach to recruiters. You review and send every message yourself.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  )
}

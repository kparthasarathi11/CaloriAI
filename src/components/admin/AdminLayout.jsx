import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { clsx } from 'clsx'
import PSKFooter from '../ui/PSKFooter'

/**
 * AdminLayout — route guard + tab navigation for the eval console.
 * Non-admins are redirected to the app home. Admin status comes from
 * the users.is_admin column (enforced again server-side by RLS).
 */
export default function AdminLayout({ children, title }) {
  const { profile, loading } = useAuth()
  const { pathname } = useLocation()

  if (loading) return null
  if (!profile?.is_admin) return <Navigate to="/" replace />

  const tabs = [
    { path: '/admin',         label: '📊 Dashboard' },
    { path: '/admin/dataset', label: '🗂️ Golden Dataset' },
    { path: '/admin/runs',    label: '▶️ Eval Runs' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 max-w-5xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">←</Link>
            <div>
              <h1 className="font-black text-slate-800">{title ?? 'Eval Console'}</h1>
              <p className="text-[10px] text-slate-400">Admin · CalorAI AI Quality System</p>
            </div>
          </div>
          <span className="tag tag-blue">🔐 Admin</span>
        </div>
        {/* Tabs */}
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
          {tabs.map(t => (
            <Link key={t.path} to={t.path}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition',
                pathname === t.path
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <main className="px-4 py-4">{children}</main>
      <PSKFooter />
    </div>
  )
}

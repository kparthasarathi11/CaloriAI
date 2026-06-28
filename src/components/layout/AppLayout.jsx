import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { path: '/',        label: 'Home',    emoji: '🏠' },
  { path: '/history', label: 'History', emoji: '📊' },
  { path: '/log',     label: null,      emoji: null, isFAB: true },
  { path: '/goals',   label: 'Goals',   emoji: '🎯' },
  { path: '/profile', label: 'Profile', emoji: '👤' },
]

export default function AppLayout({ children, title, back }) {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto relative">
      {/* Top bar */}
      {title && (
        <div className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
          {back && (
            <Link to={back} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              ←
            </Link>
          )}
          <h1 className="font-bold text-slate-800">{title}</h1>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 pb-20 overflow-y-auto">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-100 px-2 z-40">
        <div className="flex items-center h-16">
          {NAV_ITEMS.map((item) => {
            if (item.isFAB) {
              return (
                <Link key="fab" to="/log"
                  className="flex-1 flex justify-center -translate-y-3"
                >
                  <div className="w-14 h-14 rounded-2xl grad flex items-center justify-center shadow-lg shadow-blue-500/30 text-white text-2xl font-light">
                    +
                  </div>
                </Link>
              )
            }
            const active = pathname === item.path
            return (
              <Link key={item.path} to={item.path}
                className={clsx(
                  'flex-1 flex flex-col items-center gap-1 pt-1',
                  active ? 'text-blue-600' : 'text-slate-400'
                )}
              >
                <span className="text-xl">{item.emoji}</span>
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            )
          })}
        </div>
        {/* iOS safe area */}
        <div className="h-safe-area-inset-bottom" />
      </nav>
    </div>
  )
}

import { clsx } from 'clsx'

// ── Toast / Alert ─────────────────────────────────────────────────────────────

export function Alert({ type = 'error', children, className }) {
  const styles = {
    error:   'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-orange-50 border-orange-200 text-orange-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    info:    'bg-blue-50 border-blue-200 text-blue-700',
  }
  const icons = { error: '⚠️', warning: '⚠️', success: '✓', info: 'ℹ️' }
  return (
    <div className={clsx('flex items-start gap-2 rounded-xl border p-3 text-sm', styles[type], className)}>
      <span>{icons[type]}</span>
      <span>{children}</span>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = 'md', className }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }
  return (
    <div className={clsx(
      'animate-spin rounded-full border-2 border-slate-200 border-t-blue-600',
      sizes[size], className
    )} />
  )
}

// ── Macro bar ─────────────────────────────────────────────────────────────────

export function MacroBar({ label, value, target, color = 'bg-blue-500' }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0
  return (
    <div className="flex-1 bg-slate-50 rounded-xl p-3">
      <p className="text-[10px] text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-slate-800">{Math.round(value)}g</p>
      <div className="mt-2 h-1.5 rounded-full bg-slate-200">
        <div
          className={clsx('h-1.5 rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Calorie Ring (SVG) ────────────────────────────────────────────────────────

export function CalorieRing({ consumed, target, size = 120 }) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const pct = target ? Math.min(1, consumed / target) : 0
  const strokeDash = circumference * pct
  const remaining = Math.max(0, target - consumed)
  const isOver = consumed > target

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1C6FE0" />
              <stop offset="100%" stopColor="#22B8E6" />
            </linearGradient>
          </defs>
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#E2E8F0" strokeWidth="10" />
          <circle
            cx={size/2} cy={size/2} r={radius} fill="none"
            stroke={isOver ? '#EF4444' : 'url(#ring-grad)'}
            strokeWidth="10"
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-slate-800">{consumed.toLocaleString()}</span>
          <span className="text-[10px] text-slate-500">kcal eaten</span>
        </div>
      </div>
      <div className="flex-1">
        <p className="text-xs text-slate-500">Remaining</p>
        <p className={clsx('text-2xl font-black', isOver ? 'text-red-500' : 'text-green-500')}>
          {isOver ? `+${(consumed - target).toLocaleString()}` : remaining.toLocaleString()}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{isOver ? 'over target' : 'kcal left'}</p>
        <p className="text-xs text-slate-400 mt-1">Goal: {target.toLocaleString()} kcal</p>
      </div>
    </div>
  )
}

// ── Streak dots ───────────────────────────────────────────────────────────────

export function StreakDots({ dots }) {
  return (
    <div className="flex gap-1.5">
      {dots.map((dot, i) => (
        <div
          key={i}
          className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold',
            dot.status === 'done'  && 'bg-orange-500 text-white',
            dot.status === 'today' && 'bg-blue-600 text-white ring-2 ring-blue-300',
            dot.status === 'miss'  && 'bg-slate-100 text-slate-400'
          )}
        >
          {dot.label}
        </div>
      ))}
    </div>
  )
}

// ── Meal card ─────────────────────────────────────────────────────────────────

const MEAL_EMOJI = { breakfast: '🥣', lunch: '🥗', dinner: '🍽️', snack: '🍎' }

export function MealCard({ meal, onDelete }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl flex-shrink-0">
        {MEAL_EMOJI[meal.meal_type] ?? '🍴'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{meal.food_name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-slate-400 capitalize">{meal.meal_type}</span>
          {meal.source === 'ai_scan' && (
            <span className="tag tag-blue text-[9px]">✨ AI</span>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-blue-600">{meal.kcal} kcal</p>
        {onDelete && (
          <button
            onClick={() => onDelete(meal)}
            className="text-[10px] text-slate-400 hover:text-red-500 transition-colors mt-0.5"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({ icon = '🍽️', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-base font-bold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-4">{description}</p>}
      {action}
    </div>
  )
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

export function DeleteModal({ meal, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
        <h3 className="font-bold text-slate-800 mb-1">Remove meal?</h3>
        <p className="text-sm text-slate-500 mb-5">
          Remove <strong>{meal?.food_name}</strong> ({meal?.kcal} kcal)?
          <br />This cannot be undone.
        </p>
        <button onClick={onConfirm} disabled={loading} className="btn-danger mb-2">
          {loading ? 'Removing…' : 'Yes, remove it'}
        </button>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </div>
  )
}

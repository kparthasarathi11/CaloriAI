import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { useMeals } from '../hooks/useMeals'
import { supabase } from '../lib/supabase'
import AppLayout from '../components/layout/AppLayout'
import { EmptyState, MealCard, Spinner } from '../components/ui'
import PSKFooter from '../components/ui/PSKFooter'
import { clsx } from 'clsx'

export default function HistoryPage() {
  const { user }         = useAuth()
  const { fetchHistory } = useMeals(user?.id)

  const [history, setHistory]   = useState([])
  const [goals, setGoals]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (!user) return
    Promise.all([
      fetchHistory(30),
      supabase.from('goals').select('calorie_target').eq('user_id', user.id).single(),
    ]).then(([hist, { data: g }]) => {
      setHistory(hist)
      setGoals(g)
      setLoading(false)
    })
  }, [user, fetchHistory])

  const calorieTarget = goals?.calorie_target ?? 1850

  function GoalStatus({ kcal }) {
    const diff = kcal - calorieTarget
    if (kcal === 0) return <span className="tag tag-blue">No data</span>
    if (diff <= 0)  return <span className="tag tag-green">✓ Under target</span>
    return <span className="tag tag-orange">+{diff} over</span>
  }

  const selectedDay = history.find(d => d.date === selected)

  if (loading) return (
    <AppLayout title="History 📊">
      <div className="flex justify-center py-20"><Spinner /></div>
    </AppLayout>
  )

  return (
    <AppLayout title="History 📊">
      <div className="px-4 py-4">

        {/* ── DRILL-DOWN VIEW ── */}
        {selected && selectedDay && (
          <>
            <button onClick={() => setSelected(null)}
              className="text-sm text-blue-600 font-semibold mb-4 flex items-center gap-1">
              ← Back to history
            </button>

            <div className="card p-4 mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                {format(parseISO(selectedDay.date), 'EEEE, d MMMM yyyy')}
              </p>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-3xl font-black text-slate-800">
                    {selectedDay.kcal.toLocaleString()}
                  </p>
                  {/* ④ Show correct counts */}
                  <p className="text-xs text-slate-500 mt-0.5">
                    kcal · {selectedDay.count} {selectedDay.count === 1 ? 'entry' : 'entries'} logged
                  </p>
                </div>
                <GoalStatus kcal={selectedDay.kcal} />
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 mb-1">
                <div
                  className={clsx('h-1.5 rounded-full',
                    selectedDay.kcal <= calorieTarget ? 'bg-green-500' : 'bg-red-400'
                  )}
                  style={{ width: `${Math.min(100, (selectedDay.kcal / calorieTarget) * 100)}%` }}
                />
              </div>
              <div className="flex gap-2 mt-3">
                {[
                  ['Protein', Math.round(selectedDay.protein)],
                  ['Carbs',   Math.round(selectedDay.carbs)],
                  ['Fat',     Math.round(selectedDay.fat)],
                ].map(([label, val]) => (
                  <div key={label} className="flex-1 bg-slate-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="text-sm font-bold">{val}g</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Meal Entries
              </p>
              {selectedDay.meals.map((meal, i) => (
                <MealCard key={i} meal={meal} />
              ))}
            </div>
          </>
        )}

        {/* ── HISTORY LIST ── */}
        {!selected && (
          <>
            {history.length === 0 ? (
              <EmptyState
                icon="📊"
                title="No history yet"
                description="Your logged meals will appear here after your first entry."
              />
            ) : (
              <div className="space-y-2">
                {history.map(day => {
                  const pct   = Math.min(100, Math.round((day.kcal / calorieTarget) * 100))
                  const isOver = day.kcal > calorieTarget
                  return (
                    <button key={day.date} onClick={() => setSelected(day.date)}
                      className="card p-4 w-full text-left hover:border-blue-200 transition flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-800">
                          {format(parseISO(day.date), 'EEE, d MMM')}
                        </p>
                        {/* ④ "entry/entries" not "meal/meals" to avoid confusion */}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {day.count} {day.count === 1 ? 'entry' : 'entries'} logged
                        </p>
                        <div className="h-1 rounded-full bg-slate-100 mt-2">
                          <div
                            className={clsx('h-1 rounded-full', isOver ? 'bg-red-400' : 'bg-green-500')}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black text-blue-600">
                          {day.kcal.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-400">kcal</p>
                        <div className="mt-1">
                          {isOver
                            ? <span className="tag tag-orange text-[9px]">+{day.kcal - calorieTarget} over</span>
                            : <span className="tag tag-green text-[9px]">✓ On track</span>
                          }
                        </div>
                      </div>
                      <span className="text-slate-300">›</span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ⑤ PSK Footer */}
        <PSKFooter />
      </div>
    </AppLayout>
  )
}

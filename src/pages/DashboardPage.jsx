import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { useMeals } from '../hooks/useMeals'
import { supabase } from '../lib/supabase'
import { getWeekDots } from '../lib/streak'
import AppLayout from '../components/layout/AppLayout'
import { CalorieRing, MacroBar, MealCard, StreakDots, EmptyState, DeleteModal, Spinner } from '../components/ui'

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const { fetchMeals, deleteMeal, loading } = useMeals(user?.id)

  const [meals, setMeals]         = useState([])
  const [goals, setGoals]         = useState(null)
  const [streak, setStreak]       = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  // Load data
  useEffect(() => {
    if (!user) return
    async function load() {
      const [mealsData, { data: goalsData }, { data: streakData }] = await Promise.all([
        fetchMeals(),
        supabase.from('goals').select('*').eq('user_id', user.id).single(),
        supabase.from('streaks').select('*').eq('user_id', user.id).single(),
      ])
      setMeals(mealsData)
      setGoals(goalsData)
      setStreak(streakData)
    }
    load()
  }, [user, fetchMeals, refreshKey])

  // Aggregates
  const totalKcal    = meals.reduce((s, m) => s + m.kcal, 0)
  const totalProtein = meals.reduce((s, m) => s + parseFloat(m.protein_g), 0)
  const totalCarbs   = meals.reduce((s, m) => s + parseFloat(m.carbs_g), 0)
  const totalFat     = meals.reduce((s, m) => s + parseFloat(m.fat_g), 0)
  const calorieTarget = goals?.calorie_target ?? 1850
  const weekDots = getWeekDots(streak?.last_logged_date, streak?.current_streak ?? 0)

  // Delete flow
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deleteMeal(deleteTarget.id)
      setDeleteTarget(null)
      refresh()
    } catch { /* error shown by hook */ }
    finally { setDeleteLoading(false) }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <AppLayout>
      {deleteTarget && (
        <DeleteModal
          meal={deleteTarget}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      <div className="px-4 py-4 space-y-4">

        {/* Greeting */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">
              {greeting()} {profile?.name?.split(' ')[0] ?? ''} 👋
            </h2>
            <p className="text-xs text-slate-500">{format(new Date(), 'EEEE, d MMM yyyy')}</p>
          </div>
          <Link to="/profile">
            <div className="w-10 h-10 rounded-xl grad flex items-center justify-center text-white font-bold text-sm">
              {profile?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
          </Link>
        </div>

        {/* Calorie ring */}
        <div className="card p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Today's Calories</p>
          {loading && !meals.length ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <CalorieRing consumed={totalKcal} target={calorieTarget} size={120} />
          )}
        </div>

        {/* Macros */}
        <div className="card p-4">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Macros Today</p>
          <div className="flex gap-2">
            <MacroBar label="Protein" value={totalProtein} target={goals?.protein_target_g ?? 138} color="bg-blue-500" />
            <MacroBar label="Carbs"   value={totalCarbs}   target={goals?.carbs_target_g ?? 185}   color="bg-cyan-400" />
            <MacroBar label="Fat"     value={totalFat}     target={goals?.fat_target_g ?? 62}     color="bg-purple-500" />
          </div>
        </div>

        {/* Streak */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Streak</p>
            {streak?.longest_streak > 0 && (
              <span className="text-[10px] text-slate-400">Best: {streak.longest_streak} days</span>
            )}
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div>
              <span className="text-3xl font-black text-orange-500">🔥 {streak?.current_streak ?? 0}</span>
              <p className="text-xs text-slate-500">days logged</p>
            </div>
            <div className="flex-1">
              {streak?.current_streak >= 7
                ? <p className="text-xs font-semibold text-green-600">🎉 7-day streak achieved!</p>
                : <p className="text-xs text-slate-500">{7 - (streak?.current_streak ?? 0)} more days to 7-day badge</p>
              }
            </div>
          </div>
          <StreakDots dots={weekDots} />
        </div>

        {/* Today's meals */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Today's Log</p>
            <span className="text-xs text-slate-400">{totalKcal.toLocaleString()} kcal total</span>
          </div>

          {meals.length === 0 ? (
            <EmptyState
              icon="🍽️"
              title="No meals logged yet today"
              description="Tap + to log your first meal"
            />
          ) : (
            <>
              {meals.map(meal => (
                <MealCard key={meal.id} meal={meal} onDelete={setDeleteTarget} />
              ))}
            </>
          )}

          <Link to="/log" className="block mt-3">
            <div className="btn-ghost text-center text-sm">+ Add meal</div>
          </Link>
        </div>

        {/* PSK footer */}
        <p className="text-center text-[10px] text-slate-300 pb-2">
          CalorAI · Built by <span className="text-blue-400 font-semibold">PSK</span> · Focus. Build. Impact.
        </p>
      </div>
    </AppLayout>
  )
}

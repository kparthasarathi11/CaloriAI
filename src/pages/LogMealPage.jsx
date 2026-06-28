import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMeals } from '../hooks/useMeals'
import AppLayout from '../components/layout/AppLayout'
import { Alert, Spinner } from '../components/ui'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

// Simple local food suggestions (Telugu/Indian diet focused — expand as needed)
const FOOD_SUGGESTIONS = [
  { name: 'White Rice (1 cup)', kcal: 206, protein_g: 4, carbs_g: 45, fat_g: 0.4 },
  { name: 'Chapati (1 piece)', kcal: 104, protein_g: 3, carbs_g: 18, fat_g: 3 },
  { name: 'Dal (1 bowl)', kcal: 180, protein_g: 11, carbs_g: 28, fat_g: 4 },
  { name: 'Chicken Curry (1 bowl)', kcal: 340, protein_g: 28, carbs_g: 8, fat_g: 20 },
  { name: 'Idli (2 pieces)', kcal: 120, protein_g: 4, carbs_g: 24, fat_g: 0.5 },
  { name: 'Sambar (1 cup)', kcal: 90, protein_g: 4, carbs_g: 14, fat_g: 2 },
  { name: 'Dosa (1 large)', kcal: 168, protein_g: 4, carbs_g: 30, fat_g: 4 },
  { name: 'Oats (1 cup cooked)', kcal: 147, protein_g: 5, carbs_g: 25, fat_g: 3 },
  { name: 'Banana (1 medium)', kcal: 89, protein_g: 1, carbs_g: 23, fat_g: 0.3 },
  { name: 'Egg (1 boiled)', kcal: 78, protein_g: 6, carbs_g: 0.6, fat_g: 5 },
  { name: 'Milk (1 glass)', kcal: 149, protein_g: 8, carbs_g: 12, fat_g: 8 },
  { name: 'Curd / Yogurt (1 cup)', kcal: 100, protein_g: 11, carbs_g: 4, fat_g: 4 },
  { name: 'Black Coffee (1 cup)', kcal: 5, protein_g: 0.3, carbs_g: 0.5, fat_g: 0 },
  { name: 'Peanut Butter (2 tbsp)', kcal: 188, protein_g: 8, carbs_g: 6, fat_g: 16 },
  { name: 'Chicken Breast (100g grilled)', kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 4 },
]

export default function LogMealPage() {
  const navigate    = useNavigate()
  const { user }    = useAuth()
  const { addMeal } = useMeals(user?.id)

  const [query, setQuery]     = useState('')
  const [mealType, setMealType] = useState('lunch')
  const [selected, setSelected] = useState(null)
  const [custom, setCustom]   = useState({ food_name: '', kcal: '', protein_g: '', carbs_g: '', fat_g: '' })
  const [mode, setMode]       = useState('search') // 'search' | 'custom'
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const filtered = query.length > 1
    ? FOOD_SUGGESTIONS.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
    : []

  async function handleSave() {
    setError(null)
    const payload = mode === 'search' && selected
      ? { ...selected, food_name: selected.name, meal_type: mealType, source: 'manual' }
      : {
          food_name: custom.food_name,
          meal_type: mealType,
          kcal: Number(custom.kcal),
          protein_g: Number(custom.protein_g || 0),
          carbs_g: Number(custom.carbs_g || 0),
          fat_g: Number(custom.fat_g || 0),
          source: 'manual',
        }

    if (!payload.food_name) return setError('Please enter a food name.')
    if (!payload.kcal || payload.kcal <= 0) return setError('Please enter a valid calorie amount.')

    setLoading(true)
    try {
      await addMeal(payload)
      navigate('/')
    } catch {
      setError('Failed to save — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout title="Log a Meal" back="/">
      <div className="px-4 py-4 space-y-4">

        {/* AI shortcut */}
        <Link to="/scan">
          <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-2xl p-4">
            <span className="text-2xl">✨</span>
            <div>
              <p className="text-sm font-bold text-blue-700">Try AI Scan instead</p>
              <p className="text-xs text-slate-500">Photo or description — done in seconds</p>
            </div>
            <span className="ml-auto text-blue-400">→</span>
          </div>
        </Link>

        {/* Meal type */}
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">Meal type</p>
          <div className="flex gap-2">
            {MEAL_TYPES.map(t => (
              <button key={t} onClick={() => setMealType(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition border ${
                  mealType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
          <button onClick={() => { setMode('search'); setSelected(null) }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'search' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
            🔍 Search
          </button>
          <button onClick={() => { setMode('custom'); setSelected(null) }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === 'custom' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>
            ✏️ Custom
          </button>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        {/* ── SEARCH MODE ── */}
        {mode === 'search' && (
          <>
            <input
              className="input"
              placeholder="Search food… e.g. Idli, Rice, Chicken"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null) }}
            />

            {selected ? (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-slate-800">{selected.name}</p>
                  <button onClick={() => setSelected(null)} className="text-xs text-slate-400 hover:text-red-500">Change</button>
                </div>
                <div className="flex gap-2 text-center">
                  <div className="flex-1 bg-slate-50 rounded-xl p-2">
                    <p className="text-xs text-slate-500">Calories</p>
                    <p className="font-bold text-blue-600">{selected.kcal}</p>
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-xl p-2">
                    <p className="text-xs text-slate-500">Protein</p>
                    <p className="font-bold text-slate-700">{selected.protein_g}g</p>
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-xl p-2">
                    <p className="text-xs text-slate-500">Carbs</p>
                    <p className="font-bold text-slate-700">{selected.carbs_g}g</p>
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-xl p-2">
                    <p className="text-xs text-slate-500">Fat</p>
                    <p className="font-bold text-slate-700">{selected.fat_g}g</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card divide-y divide-slate-50">
                {filtered.length > 0
                  ? filtered.map((food, i) => (
                    <button key={i} onClick={() => setSelected(food)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition">
                      <span className="text-sm font-medium text-slate-700">{food.name}</span>
                      <span className="text-sm font-bold text-blue-600">{food.kcal} kcal</span>
                    </button>
                  ))
                  : query.length > 1 && (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-slate-500">No results for "{query}"</p>
                      <button onClick={() => setMode('custom')} className="text-sm text-blue-600 font-semibold mt-1">
                        Enter custom entry →
                      </button>
                    </div>
                  )
                }
                {query.length <= 1 && (
                  <p className="text-sm text-slate-400 text-center py-6">Start typing to search foods…</p>
                )}
              </div>
            )}
          </>
        )}

        {/* ── CUSTOM MODE ── */}
        {mode === 'custom' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Food name *</label>
              <input className="input" placeholder="e.g. Homemade dal"
                value={custom.food_name} onChange={e => setCustom(c => ({ ...c, food_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Calories (kcal) *</label>
              <input className="input" type="number" min="0" placeholder="e.g. 350"
                value={custom.kcal} onChange={e => setCustom(c => ({ ...c, kcal: e.target.value }))} />
            </div>
            <p className="text-xs text-slate-400">Macros (optional)</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Protein (g)</label>
                <input className="input" type="number" min="0" placeholder="0"
                  value={custom.protein_g} onChange={e => setCustom(c => ({ ...c, protein_g: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Carbs (g)</label>
                <input className="input" type="number" min="0" placeholder="0"
                  value={custom.carbs_g} onChange={e => setCustom(c => ({ ...c, carbs_g: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Fat (g)</label>
                <input className="input" type="number" min="0" placeholder="0"
                  value={custom.fat_g} onChange={e => setCustom(c => ({ ...c, fat_g: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={loading || (mode === 'search' && !selected)}
          className="btn-primary"
        >
          {loading ? <Spinner size="sm" className="mx-auto" /> : '✓ Add to Log'}
        </button>
      </div>
    </AppLayout>
  )
}

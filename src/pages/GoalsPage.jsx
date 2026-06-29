import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { calculateCalorieTarget, calculateMacros, validateCalorieTarget } from '../lib/calories'
import AppLayout from '../components/layout/AppLayout'
import { Alert, Spinner } from '../components/ui'
import PSKFooter from '../components/ui/PSKFooter'

export default function GoalsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [goals, setGoals]         = useState(null)       // existing saved goals
  const [formData, setForm]       = useState({
    calorie_target: '', protein_target_g: '',
    carbs_target_g: '', fat_target_g: '', target_weight_kg: '',
  })
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)  // ① confirmation modal

  // Load existing goals
  useEffect(() => {
    if (!user) return
    setLoading(true)
    supabase.from('goals').select('*').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setGoals(data)
          setForm({
            calorie_target:   data.calorie_target ?? '',
            protein_target_g: data.protein_target_g ?? '',
            carbs_target_g:   data.carbs_target_g ?? '',
            fat_target_g:     data.fat_target_g ?? '',
            target_weight_kg: data.target_weight_kg ?? '',
          })
        }
        setLoading(false)
      })
  }, [user])

  function handleCalorieChange(val) {
    const macros = calculateMacros(Number(val))
    setForm(f => ({ ...f, calorie_target: val, ...macros }))
  }

  // ① When user clicks Save — if goals already exist, show confirm modal first
  function handleSaveClick(e) {
    e.preventDefault()
    const calErr = validateCalorieTarget(formData.calorie_target)
    if (calErr) return setError(calErr)
    setError(null)

    if (goals) {
      // Already has goals — show replace confirmation
      setShowConfirm(true)
    } else {
      // First time saving — go straight ahead
      doSave()
    }
  }

  // ② Actually persist to DB
  async function doSave() {
    setShowConfirm(false)
    setSaving(true)
    setSuccess(false)
    try {
      const { error: err } = await supabase.from('goals').upsert({
        user_id:          user.id,
        calorie_target:   Number(formData.calorie_target),
        protein_target_g: Number(formData.protein_target_g),
        carbs_target_g:   Number(formData.carbs_target_g),
        fat_target_g:     Number(formData.fat_target_g),
        target_weight_kg: formData.target_weight_kg ? Number(formData.target_weight_kg) : null,
        updated_at:       new Date().toISOString(),
      })
      if (err) throw err
      // Refresh local goals snapshot
      const { data } = await supabase.from('goals').select('*').eq('user_id', user.id).single()
      setGoals(data)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout title="My Goals 🎯">

      {/* ── CONFIRM REPLACE MODAL ── */}
      {showConfirm && goals && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <h3 className="font-bold text-slate-800 mb-1">Replace existing goals?</h3>
            <p className="text-xs text-slate-500 mb-4">Your current goals will be overwritten:</p>

            {/* Show previous goals clearly */}
            <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Calories</span>
                <span className="font-bold text-slate-700">{goals.calorie_target} kcal</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Protein</span>
                <span className="font-bold text-slate-700">{goals.protein_target_g}g</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Carbs</span>
                <span className="font-bold text-slate-700">{goals.carbs_target_g}g</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Fat</span>
                <span className="font-bold text-slate-700">{goals.fat_target_g}g</span>
              </div>
              {goals.target_weight_kg && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Target weight</span>
                  <span className="font-bold text-slate-700">{goals.target_weight_kg} kg</span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 mb-4">
              New target: <strong className="text-blue-600">{formData.calorie_target} kcal/day</strong>
            </p>

            <button onClick={doSave} className="btn-primary mb-2">
              ✓ Yes, replace my goals
            </button>
            <button onClick={() => setShowConfirm(false)} className="btn-secondary">
              Cancel — keep current goals
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <form onSubmit={handleSaveClick} className="space-y-4">
            {error   && <Alert type="error">{error}</Alert>}
            {success && <Alert type="success">✓ Goals updated successfully!</Alert>}

            <div className="card p-4 space-y-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Daily Calorie Target</p>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Calories (kcal)</label>
                <input className="input" type="number" min="800" max="5000"
                  value={formData.calorie_target}
                  onChange={e => handleCalorieChange(e.target.value)}
                  required />
                <p className="text-xs text-slate-400 mt-1">800–5,000 kcal recommended</p>
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Macro Targets</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Protein (g)', 'protein_target_g'],
                  ['Carbs (g)',   'carbs_target_g'],
                  ['Fat (g)',     'fat_target_g'],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label className="block text-xs text-slate-600 mb-1">{label}</label>
                    <input className="input" type="number" min="0"
                      value={formData[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4 space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Weight Goal (Optional)</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Current weight (kg)</label>
                  <p className="input bg-slate-50 text-slate-500 cursor-default">
                    {profile?.weight_kg ?? '—'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Target weight (kg)</label>
                  <input className="input" type="number" min="20" max="300" step="0.1"
                    placeholder="e.g. 68"
                    value={formData.target_weight_kg}
                    onChange={e => setForm(f => ({ ...f, target_weight_kg: e.target.value }))} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" className="mx-auto" /> : '💾 Save Goals'}
            </button>

            <button type="button" className="btn-secondary" onClick={() => {
              const cal = calculateCalorieTarget({
                weight_kg:      profile?.weight_kg,
                height_cm:      profile?.height_cm,
                age:            profile?.age,
                activity_level: profile?.activity_level,
                goal_type:      profile?.goal_type,
              })
              handleCalorieChange(cal)
            }}>
              🔄 Recalculate from my stats
            </button>
          </form>
        )}

        <PSKFooter />
      </div>
    </AppLayout>
  )
}

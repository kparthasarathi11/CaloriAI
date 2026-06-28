import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calculateCalorieTarget, calculateMacros } from '../lib/calories'
import { Alert, Spinner } from '../components/ui'
import { clsx } from 'clsx'

const GOAL_OPTIONS = [
  { value: 'lose_weight',    label: 'Lose weight',     emoji: '🔥', desc: '-0.5 kg/week deficit' },
  { value: 'maintain',       label: 'Maintain weight', emoji: '⚖️', desc: 'Balanced TDEE' },
  { value: 'gain_muscle',    label: 'Build muscle',    emoji: '💪', desc: '+300 kcal surplus' },
  { value: 'improve_fitness',label: 'Improve fitness', emoji: '🏃', desc: 'Maintenance calories' },
]

const ACTIVITY_OPTIONS = [
  { value: 'sedentary',         label: 'Sedentary',          desc: 'Desk job, little exercise' },
  { value: 'lightly_active',    label: 'Lightly active',     desc: '1-3 days/week exercise' },
  { value: 'moderately_active', label: 'Moderately active',  desc: '3-5 days/week exercise' },
  { value: 'very_active',       label: 'Very active',        desc: '6-7 days/week hard exercise' },
]

function StepDots({ current, total }) {
  return (
    <div className="flex gap-2 justify-center mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={clsx(
          'h-1.5 rounded-full transition-all',
          i === current ? 'w-8 bg-blue-600' : 'w-2 bg-slate-200'
        )} />
      ))}
    </div>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, refreshProfile } = useAuth()
  const [step, setStep]           = useState(0)
  const [goal, setGoal]           = useState('')
  const [stats, setStats]         = useState({ age: '', weight_kg: '', height_cm: '', activity_level: '' })
  const [target, setTarget]       = useState(null)
  const [macros, setMacros]       = useState(null)
  const [error, setError]         = useState(null)
  const [loading, setLoading]     = useState(false)

  // ── Step 1: Calculate target ─────────────────────────────
  function handleStatsNext(e) {
    e.preventDefault()
    setError(null)
    const { age, weight_kg, height_cm, activity_level } = stats
    // Validate ranges (EC-07)
    if (age < 13 || age > 100)        return setError('Please enter a valid age (13–100).')
    if (weight_kg < 20 || weight_kg > 300) return setError('Please enter a valid weight (20–300 kg).')
    if (height_cm < 100 || height_cm > 250) return setError('Please enter a valid height (100–250 cm).')
    if (!activity_level)              return setError('Please select your activity level.')

    const cal = calculateCalorieTarget({
      weight_kg: Number(weight_kg),
      height_cm: Number(height_cm),
      age: Number(age),
      activity_level,
      goal_type: goal,
    })
    const mac = calculateMacros(cal)
    setTarget(cal)
    setMacros(mac)
    setStep(2)
  }

  // ── Step 2: Save to DB ───────────────────────────────────
  async function handleFinish() {
    setError(null)
    setLoading(true)
    try {
      // Update user profile
      const { error: userErr } = await supabase.from('users').upsert({
        id: user.id,
        name: user.user_metadata?.full_name || user.email?.split('@')[0],
        age: Number(stats.age),
        weight_kg: Number(stats.weight_kg),
        height_cm: Number(stats.height_cm),
        activity_level: stats.activity_level,
        goal_type: goal,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      })
      if (userErr) throw userErr

      // Upsert goal
      const { error: goalErr } = await supabase.from('goals').upsert({
        user_id: user.id,
        calorie_target: target,
        ...macros,
        updated_at: new Date().toISOString(),
      })
      if (goalErr) throw goalErr

      await refreshProfile()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to save — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto p-6">
      <div className="flex-1 flex flex-col justify-center">

        {/* Step 0: Goal selection */}
        {step === 0 && (
          <div>
            <StepDots current={0} total={3} />
            <h2 className="text-2xl font-black text-slate-800 mb-1">What's your goal?</h2>
            <p className="text-sm text-slate-500 mb-6">We'll personalise your daily calorie target.</p>
            <div className="space-y-3">
              {GOAL_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setGoal(opt.value)}
                  className={clsx(
                    'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition',
                    goal === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  )}>
                  <span className="text-2xl">{opt.emoji}</span>
                  <div>
                    <p className="font-bold text-slate-800">{opt.label}</p>
                    <p className="text-xs text-slate-500">{opt.desc}</p>
                  </div>
                  {goal === opt.value && <span className="ml-auto text-blue-500 text-lg">✓</span>}
                </button>
              ))}
            </div>
            <button disabled={!goal} onClick={() => setStep(1)} className="btn-primary mt-6">
              Continue →
            </button>
          </div>
        )}

        {/* Step 1: Body stats */}
        {step === 1 && (
          <form onSubmit={handleStatsNext}>
            <StepDots current={1} total={3} />
            <h2 className="text-2xl font-black text-slate-800 mb-1">Tell us about you</h2>
            <p className="text-sm text-slate-500 mb-6">Used to calculate your calorie target accurately.</p>
            {error && <Alert type="error" className="mb-4">{error}</Alert>}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
                <input className="input" type="number" placeholder="e.g. 27" min="13" max="100"
                  value={stats.age} onChange={e => setStats(s => ({ ...s, age: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Weight (kg)</label>
                  <input className="input" type="number" placeholder="e.g. 72" min="20" max="300" step="0.1"
                    value={stats.weight_kg} onChange={e => setStats(s => ({ ...s, weight_kg: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Height (cm)</label>
                  <input className="input" type="number" placeholder="e.g. 175" min="100" max="250"
                    value={stats.height_cm} onChange={e => setStats(s => ({ ...s, height_cm: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Activity Level</label>
                <div className="space-y-2">
                  {ACTIVITY_OPTIONS.map(opt => (
                    <button type="button" key={opt.value}
                      onClick={() => setStats(s => ({ ...s, activity_level: opt.value }))}
                      className={clsx(
                        'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition text-sm',
                        stats.activity_level === opt.value
                          ? 'border-blue-500 bg-blue-50 font-semibold text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700'
                      )}>
                      <span className="font-bold">{opt.label}</span>
                      <span className="text-xs text-slate-400 ml-auto">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setStep(0)} className="btn-secondary flex-none w-24">← Back</button>
              <button type="submit" className="btn-primary flex-1">Calculate →</button>
            </div>
          </form>
        )}

        {/* Step 2: Show target */}
        {step === 2 && (
          <div>
            <StepDots current={2} total={3} />
            <h2 className="text-2xl font-black text-slate-800 mb-1">Your daily target</h2>
            <p className="text-sm text-slate-500 mb-6">Based on your stats & goal. You can adjust this anytime.</p>

            {error && <Alert type="error" className="mb-4">{error}</Alert>}

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-2xl p-6 text-center mb-6">
              <p className="text-xs text-slate-500 mb-1">Daily calorie target</p>
              <p className="text-5xl font-black grad-text">{target?.toLocaleString()}</p>
              <p className="text-sm text-slate-500 mt-1">kcal / day</p>
              <p className="text-xs text-blue-500 mt-2">🤖 Calculated via Mifflin-St Jeor BMR</p>
            </div>

            <div className="flex gap-3 mb-6">
              <div className="flex-1 bg-white rounded-xl border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-500">Protein</p>
                <p className="text-lg font-black text-blue-600">{macros?.protein_target_g}g</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-500">Carbs</p>
                <p className="text-lg font-black text-cyan-500">{macros?.carbs_target_g}g</p>
              </div>
              <div className="flex-1 bg-white rounded-xl border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-500">Fat</p>
                <p className="text-lg font-black text-purple-500">{macros?.fat_target_g}g</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-secondary flex-none w-24">← Back</button>
              <button onClick={handleFinish} disabled={loading} className="btn-primary flex-1">
                {loading ? <Spinner size="sm" className="mx-auto" /> : "🚀 Let's start!"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { calculateBMI, getBMICategory } from '../lib/calories'
import AppLayout from '../components/layout/AppLayout'
import { Alert, Spinner } from '../components/ui'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const [form, setForm]       = useState({
    name:       profile?.name ?? '',
    age:        profile?.age ?? '',
    weight_kg:  profile?.weight_kg ?? '',
    height_cm:  profile?.height_cm ?? '',
  })
  const [saving, setSaving]   = useState(false)
  const [loggingOut, setOut]  = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(false)

  const bmi = calculateBMI(Number(form.weight_kg), Number(form.height_cm))
  const bmiCat = bmi ? getBMICategory(bmi) : null

  async function handleSave(e) {
    e.preventDefault()
    setError(null); setSuccess(false); setSaving(true)
    try {
      const { error: err } = await supabase.from('users').update({
        name:      form.name,
        age:       Number(form.age),
        weight_kg: Number(form.weight_kg),
        height_cm: Number(form.height_cm),
        updated_at: new Date().toISOString(),
      }).eq('id', user.id)
      if (err) throw err
      await refreshProfile()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  async function handleLogout() {
    setOut(true)
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <AppLayout title="Profile 👤">
      <div className="px-4 py-4 space-y-4">

        {/* Avatar */}
        <div className="card p-6 text-center">
          <div className="w-16 h-16 rounded-2xl grad flex items-center justify-center text-white text-2xl font-black mx-auto mb-3">
            {profile?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <p className="font-bold text-slate-800">{profile?.name}</p>
          <p className="text-sm text-slate-500">{user?.email}</p>
          {bmi && (
            <div className="mt-2">
              <span className="tag tag-blue">BMI {bmi} · </span>
              <span className={`text-xs font-semibold ${bmiCat?.color}`}>{bmiCat?.label}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Weight', `${profile?.weight_kg ?? '—'}kg`],
            ['Height', `${profile?.height_cm ?? '—'}cm`],
            ['Age', profile?.age ?? '—'],
          ].map(([label, value]) => (
            <div key={label} className="card p-3 text-center">
              <p className="text-sm font-black text-slate-800">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Edit form */}
        <form onSubmit={handleSave} className="card p-4 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Edit Profile</p>
          {error   && <Alert type="error">{error}</Alert>}
          {success && <Alert type="success">Profile updated!</Alert>}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
            <input className="input" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email (read-only)</label>
            <input className="input opacity-50 cursor-not-allowed" value={user?.email ?? ''} readOnly />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[['Age', 'age', 13, 100], ['Weight (kg)', 'weight_kg', 20, 300], ['Height (cm)', 'height_cm', 100, 250]].map(([label, key, min, max]) => (
              <div key={key}>
                <label className="block text-xs text-slate-600 mb-1">{label}</label>
                <input className="input" type="number" min={min} max={max}
                  value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>

          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Spinner size="sm" className="mx-auto" /> : '💾 Save Changes'}
          </button>
        </form>

        {/* Logout */}
        <button onClick={handleLogout} disabled={loggingOut} className="btn-danger">
          {loggingOut ? <Spinner size="sm" className="mx-auto" /> : '🚪 Log Out'}
        </button>

        {/* PSK footer */}
        <div className="text-center text-xs text-slate-400 pb-4">
          <p>CalorAI v1.0 · Portfolio Project</p>
          <p className="mt-0.5">
            Built by{' '}
            <a href="https://linkedin.com/in/partha-sarathi-komati" target="_blank" rel="noreferrer"
              className="text-blue-500 font-semibold">
              Partha Sarathi Komati
            </a>
            {' '}· IIM Udaipur
          </p>
        </div>
      </div>
    </AppLayout>
  )
}

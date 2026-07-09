import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import AdminLayout from '../../components/admin/AdminLayout'
import { Alert, Spinner, EmptyState } from '../../components/ui'
import { clsx } from 'clsx'

const EMPTY_FORM = {
  case_type: 'text', text_input: '', image_url: '',
  true_kcal: '', true_protein_g: '', true_carbs_g: '', true_fat_g: '',
  source: '', category: 'general', difficulty: 'normal', notes: '',
}

const TRUSTED_SOURCES = [
  'USDA FoodData Central (fdc.nal.usda.gov)',
  'IFCT 2017 (ICMR-NIN Indian Food Composition Tables)',
  'Nutrition5k (Google Research)',
  'Printed nutrition label',
  'Kitchen scale + USDA lookup',
]

export default function GoldenDatasetPage() {
  const { user } = useAuth()
  const [cases, setCases]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [filter, setFilter]     = useState('all')

  const load = useCallback(async () => {
    const { data } = await supabase.from('golden_dataset')
      .select('*').order('created_at', { ascending: false })
    setCases(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    // Validation — provenance is mandatory for a credible eval set
    if (!form.source.trim()) return setError('Source is required — every case must be auditable (e.g. "USDA FDC #173944").')
    if (form.case_type === 'text' && !form.text_input.trim()) return setError('Text input is required for text cases.')
    if (form.case_type === 'image' && !form.image_url.trim()) return setError('A public image URL is required for image cases.')
    if (!form.true_kcal || Number(form.true_kcal) < 0) return setError('Enter a valid ground-truth calorie value.')

    setSaving(true)
    try {
      const { error: err } = await supabase.from('golden_dataset').insert({
        case_type:      form.case_type,
        text_input:     form.case_type === 'text' ? form.text_input.trim() : null,
        image_url:      form.case_type === 'image' ? form.image_url.trim() : null,
        true_kcal:      Number(form.true_kcal),
        true_protein_g: Number(form.true_protein_g || 0),
        true_carbs_g:   Number(form.true_carbs_g || 0),
        true_fat_g:     Number(form.true_fat_g || 0),
        source:         form.source.trim(),
        category:       form.category,
        difficulty:     form.difficulty,
        notes:          form.notes.trim() || null,
        created_by:     user.id,
      })
      if (err) throw err
      setForm(EMPTY_FORM)
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  async function toggleActive(c) {
    await supabase.from('golden_dataset').update({ is_active: !c.is_active }).eq('id', c.id)
    await load()
  }

  const filtered = filter === 'all' ? cases : cases.filter(c => c.case_type === filter)

  return (
    <AdminLayout title="Golden Dataset">
      <div className="space-y-4">

        {/* Info banner about trusted sources */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
          <p className="text-xs text-blue-700">
            <strong>Every case needs a verifiable source.</strong> Recommended: USDA FoodData Central,
            IFCT 2017 (Indian foods), Nutrition5k, or a printed nutrition label. This is what makes
            eval numbers credible.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            {['all', 'text', 'image'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize',
                  filter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500')}>
                {f} {f !== 'all' && `(${cases.filter(c => c.case_type === f).length})`}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(v => !v)} className="btn-primary w-auto px-4 py-2 text-xs">
            {showForm ? '✕ Cancel' : '+ Add Case'}
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <form onSubmit={handleSave} className="card p-4 space-y-3">
            {error && <Alert type="error">{error}</Alert>}

            <div className="flex gap-2">
              {['text', 'image'].map(t => (
                <button type="button" key={t} onClick={() => setForm(f => ({ ...f, case_type: t }))}
                  className={clsx('flex-1 py-2 rounded-xl text-xs font-semibold capitalize border',
                    form.case_type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200')}>
                  {t === 'text' ? '💬 Text case' : '📸 Image case'}
                </button>
              ))}
            </div>

            {form.case_type === 'text' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Text input (what the AI receives) *</label>
                <input className="input" placeholder='e.g. "2 idli with 1 cup sambar"'
                  value={form.text_input} onChange={e => setForm(f => ({ ...f, text_input: e.target.value }))} />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Public image URL *</label>
                <input className="input" placeholder="https://… (must be publicly accessible)"
                  value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tip: upload to Supabase Storage (public bucket) or GitHub raw URL, then paste the link here.
                </p>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              {[['kcal *', 'true_kcal'], ['Protein g', 'true_protein_g'], ['Carbs g', 'true_carbs_g'], ['Fat g', 'true_fat_g']].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-[10px] text-slate-600 mb-1">{label}</label>
                  <input className="input" type="number" min="0" step="0.1"
                    value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Source (provenance) *</label>
              <input className="input" list="trusted-sources" placeholder='e.g. "USDA FDC #173944 (banana, raw, 118g)"'
                value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
              <datalist id="trusted-sources">
                {TRUSTED_SOURCES.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Category</label>
                <select className="input" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {['general', 'indian', 'packaged', 'multi_item', 'edge_case'].map(c =>
                    <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Difficulty</label>
                <select className="input" value={form.difficulty}
                  onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                  {['easy', 'normal', 'hard', 'edge_case'].map(d =>
                    <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Notes (optional)</label>
              <input className="input" placeholder="e.g. weighed on kitchen scale, 180g portion"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Spinner size="sm" className="mx-auto" /> : '💾 Add to Golden Dataset'}
            </button>
          </form>
        )}

        {/* Case list */}
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="🗂️" title="No cases yet"
            description="Run the SQL migration to seed 15 verified text cases, or add cases above." />
        ) : (
          <div className="space-y-2">
            {filtered.map(c => (
              <div key={c.id} className={clsx('card p-3', !c.is_active && 'opacity-50')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="tag tag-blue text-[9px]">{c.case_type === 'image' ? '📸' : '💬'} {c.case_type}</span>
                      <span className="tag tag-green text-[9px]">{c.category}</span>
                      {c.difficulty === 'edge_case' && <span className="tag tag-orange text-[9px]">edge case</span>}
                      {c.difficulty === 'hard' && <span className="tag tag-red text-[9px]">hard</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {c.case_type === 'text' ? c.text_input : c.image_url}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">📚 {c.source}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-black text-blue-600">{c.true_kcal}</p>
                    <p className="text-[9px] text-slate-400">true kcal</p>
                    <button onClick={() => toggleActive(c)}
                      className={clsx('text-[10px] font-semibold mt-1',
                        c.is_active ? 'text-slate-400 hover:text-red-500' : 'text-green-600')}>
                      {c.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useMeals } from '../hooks/useMeals'
import { analyseMealPhoto, estimateFromText, GeminiError, validateImageFile } from '../lib/gemini'
import AppLayout from '../components/layout/AppLayout'
import { Alert, Spinner } from '../components/ui'
import { clsx } from 'clsx'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

export default function AIScanPage() {
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const { addMeal } = useMeals(user?.id)

  const fileRef    = useRef(null)
  const [tab, setTab]         = useState('photo')       // 'photo' | 'text'
  const [mealType, setMealType] = useState('lunch')
  const [preview, setPreview] = useState(null)
  const [file, setFile]       = useState(null)
  const [textInput, setTextInput] = useState('')
  const [result, setResult]   = useState(null)
  const [editedItems, setEditedItems] = useState([])
  const [status, setStatus]   = useState('idle')        // idle | scanning | done | saving
  const [error, setError]     = useState(null)

  // ── File selection ──────────────────────────────────────
  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const validation = validateImageFile(f)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError(null)
    setResult(null)
  }

  // ── Photo scan ──────────────────────────────────────────
  async function handlePhotoScan() {
    if (!file) return
    setError(null)
    setStatus('scanning')
    try {
      const data = await analyseMealPhoto(file)
      if (!data.items.length) {
        setError("Couldn't identify any food in this photo — try the text description instead.")
        setStatus('idle')
        return
      }
      if (data.confidence < 0.5) {
        setError('Low confidence result — please review items carefully before saving.')
      }
      setResult(data)
      setEditedItems(data.items.map((item, i) => ({ ...item, id: i })))
      setStatus('done')
    } catch (err) {
      setError(err instanceof GeminiError ? err.message : 'Unexpected error — please try again.')
      setStatus('idle')
    }
  }

  // ── Text estimation ─────────────────────────────────────
  async function handleTextEstimate() {
    if (!textInput.trim()) return
    setError(null)
    setStatus('scanning')
    try {
      const data = await estimateFromText(textInput)
      const syntheticResult = {
        items: [{ name: data.food_name, portion: 'as described', kcal: data.kcal, protein_g: data.protein_g, carbs_g: data.carbs_g, fat_g: data.fat_g, id: 0 }],
        total_kcal: data.kcal,
        confidence: 0.8,
      }
      setResult(syntheticResult)
      setEditedItems(syntheticResult.items)
      setStatus('done')
    } catch (err) {
      setError(err instanceof GeminiError ? err.message : 'Unexpected error — please try again.')
      setStatus('idle')
    }
  }

  // ── Edit item ───────────────────────────────────────────
  function updateItem(id, field, value) {
    setEditedItems(items => items.map(item =>
      item.id === id ? { ...item, [field]: field === 'name' ? value : Number(value) } : item
    ))
  }
  function removeItem(id) {
    setEditedItems(items => items.filter(item => item.id !== id))
  }

  // ── Save ────────────────────────────────────────────────
  async function handleSave() {
    if (!editedItems.length) return
    setStatus('saving')
    setError(null)
    try {
      for (const item of editedItems) {
        await addMeal({
          food_name: item.name,
          meal_type: mealType,
          kcal: item.kcal,
          protein_g: item.protein_g ?? 0,
          carbs_g: item.carbs_g ?? 0,
          fat_g: item.fat_g ?? 0,
          source: tab === 'photo' ? 'ai_scan' : 'ai_text',
          ai_confidence: result?.confidence ?? null,
        })
      }
      navigate('/')
    } catch {
      setError('Failed to save — please try again.')
      setStatus('done')
    }
  }

  const totalKcal = editedItems.reduce((s, i) => s + (Number(i.kcal) || 0), 0)

  return (
    <AppLayout title="AI Meal Scan ✨" back="/">
      <div className="px-4 py-4 space-y-4">

        {/* Tab toggle */}
        <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
          <button onClick={() => { setTab('photo'); setResult(null); setError(null) }}
            className={clsx('flex-1 py-2 rounded-lg text-sm font-semibold transition',
              tab === 'photo' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}>
            📸 Photo
          </button>
          <button onClick={() => { setTab('text'); setResult(null); setError(null) }}
            className={clsx('flex-1 py-2 rounded-lg text-sm font-semibold transition',
              tab === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}>
            💬 Describe
          </button>
        </div>

        {/* Meal type */}
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">Meal type</p>
          <div className="flex gap-2">
            {MEAL_TYPES.map(t => (
              <button key={t} onClick={() => setMealType(t)}
                className={clsx('flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition border',
                  mealType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200')}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Powered by badge */}
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
          <span className="text-blue-500">✨</span>
          <p className="text-xs text-blue-700 font-medium">Powered by Gemini 1.5 Flash Vision API</p>
        </div>

        {/* Error */}
        {error && <Alert type={error.includes('Low confidence') ? 'warning' : 'error'}>{error}</Alert>}

        {/* ── PHOTO TAB ── */}
        {tab === 'photo' && status !== 'done' && (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-blue-200 rounded-2xl p-6 text-center bg-blue-50/40 cursor-pointer hover:bg-blue-50 transition"
            >
              {preview ? (
                <img src={preview} alt="Meal preview" className="w-full max-h-48 object-contain rounded-xl mx-auto mb-2" />
              ) : (
                <>
                  <div className="text-4xl mb-3">📸</div>
                  <p className="text-sm font-semibold text-slate-700">Take a photo or upload</p>
                  <p className="text-xs text-slate-500 mt-1">JPEG, PNG, WebP · max 10MB</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="hidden" onChange={handleFileChange} />

            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} className="btn-secondary flex-1">🖼️ Gallery</button>
              <button onClick={() => { fileRef.current.capture = 'environment'; fileRef.current?.click() }}
                className="btn-secondary flex-1">📷 Camera</button>
            </div>

            <button
              onClick={handlePhotoScan}
              disabled={!file || status === 'scanning'}
              className="btn-primary"
            >
              {status === 'scanning'
                ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" /> Analysing…</span>
                : 'Analyse with AI →'
              }
            </button>
            <p className="text-center text-xs text-slate-400">⚡ Results in ~2 seconds</p>
          </>
        )}

        {/* ── TEXT TAB ── */}
        {tab === 'text' && status !== 'done' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Describe what you ate</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder="e.g. 2 idli with sambar and coconut chutney, one cup of coffee with milk"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
              />
            </div>
            <button
              onClick={handleTextEstimate}
              disabled={!textInput.trim() || status === 'scanning'}
              className="btn-primary"
            >
              {status === 'scanning'
                ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" /> Estimating…</span>
                : 'Estimate Calories →'
              }
            </button>
          </>
        )}

        {/* ── RESULTS ── */}
        {status === 'done' && editedItems.length > 0 && (
          <div>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="tag tag-blue">✨ AI Detected</span>
                {result?.confidence && (
                  <span className="text-xs text-slate-400">{Math.round(result.confidence * 100)}% confidence</span>
                )}
              </div>

              <div className="space-y-2">
                {editedItems.map(item => (
                  <div key={item.id} className="bg-white rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <input
                        className="text-sm font-semibold text-slate-800 w-full bg-transparent border-b border-slate-100 focus:border-blue-400 outline-none pb-0.5"
                        value={item.name}
                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                      />
                      <p className="text-xs text-slate-400 mt-1">{item.portion}</p>
                    </div>
                    <div className="text-right">
                      <input
                        type="number"
                        className="text-sm font-bold text-blue-600 w-16 text-right bg-transparent border-b border-slate-100 focus:border-blue-400 outline-none"
                        value={item.kcal}
                        onChange={e => updateItem(item.id, 'kcal', e.target.value)}
                        min="0"
                      />
                      <p className="text-[10px] text-slate-400">kcal</p>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-400 transition ml-1">✕</button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center mt-3 pt-3 border-t border-blue-100">
                <span className="text-xs text-slate-500">Total estimated</span>
                <span className="text-lg font-black text-slate-800">{totalKcal} kcal</span>
              </div>
            </div>

            <button onClick={handleSave} disabled={status === 'saving'} className="btn-primary mb-2">
              {status === 'saving'
                ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" /> Saving…</span>
                : '✓ Confirm & Add to Log'
              }
            </button>
            <button onClick={() => { setStatus('idle'); setResult(null); setError(null) }}
              className="btn-secondary">
              ← Try again
            </button>
          </div>
        )}

        {/* Empty result */}
        {status === 'done' && editedItems.length === 0 && (
          <Alert type="warning">
            All items removed. Add at least one item or{' '}
            <button onClick={() => { setStatus('idle'); setResult(null) }} className="underline font-semibold">try again</button>.
          </Alert>
        )}
      </div>
    </AppLayout>
  )
}

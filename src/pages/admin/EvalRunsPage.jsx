import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { runEval, fetchRunDetail } from '../../lib/evals'
import AdminLayout from '../../components/admin/AdminLayout'
import { Alert, Spinner, EmptyState } from '../../components/ui'
import { format, parseISO } from 'date-fns'
import { clsx } from 'clsx'

export default function EvalRunsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [runs, setRuns]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [runName, setRunName]     = useState('')
  const [promptVersion, setPromptVersion] = useState('v1')
  const [caseFilter, setCaseFilter] = useState('all')
  const [running, setRunning]     = useState(false)
  const [progress, setProgress]   = useState(null)
  const [error, setError]         = useState(null)
  const [detail, setDetail]       = useState(null) // { run, results }

  const load = useCallback(async () => {
    const { data } = await supabase.from('eval_runs')
      .select('*').order('started_at', { ascending: false }).limit(30)
    setRuns(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Deep-link: /admin/runs?run=<id> opens drill-down
  useEffect(() => {
    const runId = searchParams.get('run')
    if (runId) fetchRunDetail(runId).then(setDetail)
  }, [searchParams])

  async function handleRun() {
    setError(null)
    setRunning(true)
    setProgress({ done: 0, total: 0, current: 'Loading golden dataset…' })
    try {
      const runId = await runEval({
        userId: user.id,
        runName: runName || undefined,
        promptVersion,
        caseTypeFilter: caseFilter,
        onProgress: setProgress,
      })
      setRunName('')
      await load()
      setSearchParams({ run: runId }) // auto-open results
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  // ── DRILL-DOWN VIEW ──────────────────────────────────────
  if (detail) {
    const { run, results } = detail
    const worst = results.filter(r => r.status === 'ok').slice(0, 5)
    return (
      <AdminLayout title="Run Detail">
        <button onClick={() => { setDetail(null); setSearchParams({}) }}
          className="text-sm text-blue-600 font-semibold mb-4">← All runs</button>

        <div className="card p-4 mb-4">
          <p className="font-bold text-slate-800">{run.run_name}</p>
          <p className="text-[10px] text-slate-400 mb-3">
            {run.model} · prompt {run.prompt_version} · {format(parseISO(run.started_at), 'd MMM yyyy HH:mm')}
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ['MAPE', run.mape_pct != null ? `${run.mape_pct}%` : '—'],
              ['MAE', run.mae_kcal != null ? `±${Math.round(run.mae_kcal)}` : '—'],
              ['Conf. corr', run.confidence_correlation ?? '—'],
              ['Failures', `${run.failed_cases}/${run.total_cases}`],
            ].map(([l, v]) => (
              <div key={l} className="bg-slate-50 rounded-xl p-2">
                <p className="text-sm font-black text-slate-800">{v}</p>
                <p className="text-[9px] text-slate-400">{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Per-case results — sorted worst-first (error analysis view) */}
        <div className="card p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Per-Case Results (worst first)
          </p>
          <div className="space-y-2">
            {results.map(r => {
              const gc = r.golden_dataset
              return (
                <div key={r.id} className="p-3 rounded-xl bg-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">
                        {gc?.case_type === 'image' ? '📸 ' : '💬 '}
                        {gc?.text_input ?? gc?.image_url}
                      </p>
                      <p className="text-[10px] text-slate-400">📚 {gc?.source}</p>
                    </div>
                    {r.status === 'ok' ? (
                      <div className="text-right flex-shrink-0">
                        <p className={clsx('text-sm font-black',
                          r.pct_error <= 15 ? 'text-green-600' : r.pct_error <= 30 ? 'text-orange-500' : 'text-red-500')}>
                          {r.pct_error}%
                        </p>
                        <p className="text-[9px] text-slate-400">error</p>
                      </div>
                    ) : (
                      <span className="tag tag-red text-[9px]">{r.status}</span>
                    )}
                  </div>
                  {r.status === 'ok' && (
                    <div className="flex gap-3 mt-1.5 text-[10px] text-slate-500">
                      <span>True: <strong>{gc?.true_kcal}</strong> kcal</span>
                      <span>Predicted: <strong>{r.predicted_kcal}</strong> kcal</span>
                      <span>Off by: <strong>{r.abs_error_kcal}</strong></span>
                      {r.ai_confidence != null && <span>Conf: <strong>{Math.round(r.ai_confidence * 100)}%</strong></span>}
                      <span className="ml-auto">{r.latency_ms}ms</span>
                    </div>
                  )}
                  {r.error_message && (
                    <p className="text-[10px] text-red-500 mt-1">{r.error_message}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </AdminLayout>
    )
  }

  // ── MAIN VIEW ────────────────────────────────────────────
  return (
    <AdminLayout title="Eval Runs">
      <div className="space-y-4">

        {/* New run form */}
        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">▶️ New Eval Run</p>
          {error && <Alert type="error">{error}</Alert>}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Run name (label this iteration)</label>
            <input className="input" placeholder='e.g. "Baseline — prompt v1" or "Added gram-first reasoning"'
              value={runName} onChange={e => setRunName(e.target.value)} disabled={running} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Prompt version tag</label>
              <input className="input" value={promptVersion}
                onChange={e => setPromptVersion(e.target.value)} disabled={running} />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Case types</label>
              <select className="input" value={caseFilter}
                onChange={e => setCaseFilter(e.target.value)} disabled={running}>
                <option value="all">All cases</option>
                <option value="text">💬 Text only</option>
                <option value="image">📸 Image only</option>
              </select>
            </div>
          </div>

          {/* Live progress */}
          {running && progress && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="flex justify-between text-xs font-semibold text-blue-700 mb-1.5">
                <span>Running eval…</span>
                <span>{progress.done}/{progress.total || '?'}</span>
              </div>
              <div className="h-2 rounded-full bg-blue-100 mb-1.5">
                <div className="h-2 rounded-full grad transition-all"
                  style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '5%' }} />
              </div>
              <p className="text-[10px] text-blue-600 truncate">{progress.current}</p>
              <p className="text-[9px] text-slate-400 mt-1">
                Keep this tab open — cases run sequentially to respect Groq rate limits (~1.2s gap).
              </p>
            </div>
          )}

          <button onClick={handleRun} disabled={running} className="btn-primary">
            {running
              ? <span className="flex items-center justify-center gap-2"><Spinner size="sm" /> Evaluating…</span>
              : '▶️ Run Eval Against Golden Dataset'}
          </button>
        </div>

        {/* Run history */}
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : runs.length === 0 ? (
          <EmptyState icon="🧪" title="No runs yet" description="Run your first eval above." />
        ) : (
          <div className="card p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Run History</p>
            <div className="space-y-2">
              {runs.map(r => (
                <button key={r.id}
                  onClick={() => setSearchParams({ run: r.id })}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50 transition text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-700 truncate">{r.run_name}</p>
                      {r.status !== 'completed' && (
                        <span className={clsx('tag text-[9px]', r.status === 'running' ? 'tag-orange' : 'tag-red')}>
                          {r.status}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {r.prompt_version} · {r.case_type_filter} · {r.completed_cases}/{r.total_cases} ok · {format(parseISO(r.started_at), 'd MMM HH:mm')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-sm font-black text-blue-600">{r.mape_pct != null ? `${r.mape_pct}%` : '—'}</p>
                    <p className="text-[9px] text-slate-400">MAPE</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

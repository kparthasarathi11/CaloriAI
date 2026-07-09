import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid, Legend,
} from 'recharts'
import { fetchEvalDashboard } from '../../lib/evals'
import AdminLayout from '../../components/admin/AdminLayout'
import { Spinner, EmptyState } from '../../components/ui'
import { format, parseISO } from 'date-fns'

function MetricCard({ label, value, sub, good }) {
  return (
    <div className="card p-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-black mt-1 ${good === true ? 'text-green-600' : good === false ? 'text-red-500' : 'text-slate-800'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AdminDashboardPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvalDashboard().then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading) return (
    <AdminLayout title="Eval Dashboard">
      <div className="flex justify-center py-20"><Spinner /></div>
    </AdminLayout>
  )

  const runs = data?.runs ?? []
  const latest = runs[0]
  const stats = data?.datasetStats ?? []
  const activeCases = stats.filter(s => s.is_active)
  const imageCases  = activeCases.filter(s => s.case_type === 'image').length
  const textCases   = activeCases.filter(s => s.case_type === 'text').length

  // Trend data — oldest first for charts
  const trend = [...runs].reverse().map(r => ({
    name: r.run_name?.slice(0, 14) ?? format(parseISO(r.started_at), 'd MMM HH:mm'),
    'MAPE %': r.mape_pct,
    'MAE kcal': r.mae_kcal,
    date: format(parseISO(r.started_at), 'd MMM'),
  }))

  // Dataset composition by category
  const catCounts = {}
  for (const s of activeCases) catCounts[s.category ?? 'general'] = (catCounts[s.category ?? 'general'] ?? 0) + 1
  const catData = Object.entries(catCounts).map(([category, count]) => ({ category, count }))

  return (
    <AdminLayout title="Eval Dashboard">
      <div className="space-y-4">

        {runs.length === 0 ? (
          <EmptyState
            icon="🧪"
            title="No completed eval runs yet"
            description="Run your first eval to see accuracy metrics here."
            action={<Link to="/admin/runs" className="btn-primary inline-block w-auto px-8">▶️ Run First Eval</Link>}
          />
        ) : (
          <>
            {/* Latest run headline metrics */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Latest Run — {latest.run_name}</p>
                <p className="text-[10px] text-slate-400">{format(parseISO(latest.started_at), 'd MMM yyyy, HH:mm')}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MetricCard
                  label="MAPE (avg % error)"
                  value={latest.mape_pct != null ? `${latest.mape_pct}%` : '—'}
                  sub={latest.mape_pct != null ? (latest.mape_pct <= 20 ? 'Good — under 20%' : 'Needs improvement') : ''}
                  good={latest.mape_pct != null ? latest.mape_pct <= 20 : undefined}
                />
                <MetricCard
                  label="MAE (avg kcal off)"
                  value={latest.mae_kcal != null ? `±${Math.round(latest.mae_kcal)}` : '—'}
                  sub="kcal per prediction"
                />
                <MetricCard
                  label="Confidence calibration"
                  value={latest.confidence_correlation ?? '—'}
                  sub={latest.confidence_correlation != null
                    ? (latest.confidence_correlation > 0.3 ? 'Confidence is meaningful' : 'Poorly calibrated')
                    : 'Pearson r (conf vs accuracy)'}
                  good={latest.confidence_correlation != null ? latest.confidence_correlation > 0.3 : undefined}
                />
                <MetricCard
                  label="Failure rate"
                  value={latest.total_cases ? `${Math.round((latest.failed_cases / latest.total_cases) * 100)}%` : '—'}
                  sub={`${latest.failed_cases}/${latest.total_cases} cases errored`}
                  good={latest.total_cases ? latest.failed_cases / latest.total_cases <= 0.05 : undefined}
                />
              </div>
            </div>

            {/* Accuracy trend across runs */}
            {trend.length >= 2 && (
              <div className="card p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  📉 Accuracy Trend (lower is better)
                </p>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer>
                    <LineChart data={trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="MAPE %" stroke="#1C6FE0" strokeWidth={2.5} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="MAE kcal" stroke="#22B8E6" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Each point is one eval run. A downward slope means prompt/model iterations are improving accuracy.
                </p>
              </div>
            )}

            {/* Latency + confidence row */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="Avg latency" value={latest.avg_latency_ms ? `${(latest.avg_latency_ms / 1000).toFixed(1)}s` : '—'} sub="per AI call" />
              <MetricCard label="Avg AI confidence" value={latest.avg_confidence != null ? `${Math.round(latest.avg_confidence * 100)}%` : '—'} sub="self-reported by model" />
            </div>
          </>
        )}

        {/* Dataset composition */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">🗂️ Golden Dataset Composition</p>
            <Link to="/admin/dataset" className="text-xs text-blue-600 font-semibold">Manage →</Link>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-slate-800">{activeCases.length}</p>
              <p className="text-[10px] text-slate-400">Active cases</p>
            </div>
            <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-blue-600">{imageCases}</p>
              <p className="text-[10px] text-slate-400">📸 Image</p>
            </div>
            <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xl font-black text-cyan-500">{textCases}</p>
              <p className="text-[10px] text-slate-400">💬 Text</p>
            </div>
          </div>
          {catData.length > 0 && (
            <div style={{ width: '100%', height: 160 }}>
              <ResponsiveContainer>
                <BarChart data={catData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                  <Bar dataKey="count" fill="#1C6FE0" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent runs table */}
        {runs.length > 0 && (
          <div className="card p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Runs</p>
            <div className="space-y-2">
              {runs.slice(0, 6).map(r => (
                <Link key={r.id} to={`/admin/runs?run=${r.id}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 transition">
                  <div>
                    <p className="text-xs font-bold text-slate-700">{r.run_name}</p>
                    <p className="text-[10px] text-slate-400">
                      {r.prompt_version} · {r.case_type_filter} · {format(parseISO(r.started_at), 'd MMM HH:mm')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-blue-600">{r.mape_pct != null ? `${r.mape_pct}%` : '—'}</p>
                    <p className="text-[9px] text-slate-400">MAPE</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

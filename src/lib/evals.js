/**
 * CalorAI — Eval Engine
 * Runs golden dataset cases against the Groq API, computes error metrics,
 * and persists everything to Supabase (eval_runs + eval_results).
 *
 * Design notes (senior-eng rationale):
 * - Every run is persisted BEFORE execution starts so a crashed run is visible
 *   as status='running' → can be marked failed, never silently lost.
 * - Per-case results store raw_response JSONB so failures are debuggable later.
 * - Metrics are computed client-side after all cases finish, then written once.
 * - Sequential execution with a small delay respects Groq free-tier rate limits.
 */
import { supabase } from './supabase'
import { estimateFromText, GeminiError } from './gemini'

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions'
const API_KEY    = import.meta.env.VITE_GROQ_API_KEY
const MODEL      = 'meta-llama/llama-4-scout-17b-16e-instruct'
const CASE_DELAY_MS = 1200 // gap between cases to stay under rate limits

// ── Image case runner (image URL → Groq vision) ────────────────────────────
async function runImageCase(imageUrl) {
  const prompt = `You are a nutrition expert. Carefully analyse this meal photo.
Return ONLY valid JSON with NO markdown:
{"items":[{"name":"","portion":"","kcal":0,"protein_g":0,"carbs_g":0,"fat_g":0}],"total_kcal":0,"confidence":0.0}
If no food is identifiable return {"items":[],"total_kcal":0,"confidence":0}.
Be conservative with estimates.`

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })
  if (!res.ok) throw new GeminiError(`API ${res.status}`, String(res.status))
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new GeminiError('Empty response', 'EMPTY_RESPONSE')
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  return JSON.parse(clean)
}

// ── Normalise predictions from either runner ───────────────────────────────
function extractPrediction(raw) {
  // Text runner returns flat {kcal,...}; image returns {items,total_kcal,confidence}
  if (typeof raw.total_kcal === 'number' && Array.isArray(raw.items)) {
    const sum = (k) => raw.items.reduce((s, i) => s + (Number(i[k]) || 0), 0)
    return {
      kcal: raw.total_kcal || sum('kcal'),
      protein_g: sum('protein_g'),
      carbs_g: sum('carbs_g'),
      fat_g: sum('fat_g'),
      confidence: raw.confidence ?? null,
    }
  }
  return {
    kcal: raw.kcal ?? 0,
    protein_g: raw.protein_g ?? 0,
    carbs_g: raw.carbs_g ?? 0,
    fat_g: raw.fat_g ?? 0,
    confidence: raw.confidence ?? 0.8,
  }
}

// ── Pearson correlation (confidence vs accuracy) ───────────────────────────
function pearson(xs, ys) {
  const n = xs.length
  if (n < 3) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx2 = 0, dy2 = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy
  }
  const den = Math.sqrt(dx2 * dy2)
  return den === 0 ? null : Number((num / den).toFixed(3))
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * Run a full eval.
 * @param {object} opts
 * @param {string} opts.userId       - admin user id
 * @param {string} opts.runName      - human label e.g. 'Prompt v2 baseline'
 * @param {string} opts.promptVersion
 * @param {'all'|'image'|'text'} opts.caseTypeFilter
 * @param {(progress:{done:number,total:number,current:string})=>void} opts.onProgress
 * @returns {Promise<string>} run id
 */
export async function runEval({ userId, runName, promptVersion = 'v1', caseTypeFilter = 'all', onProgress }) {
  // 1. Load active golden cases
  let query = supabase.from('golden_dataset').select('*').eq('is_active', true)
  if (caseTypeFilter !== 'all') query = query.eq('case_type', caseTypeFilter)
  const { data: cases, error: casesErr } = await query.order('created_at')
  if (casesErr) throw casesErr
  if (!cases?.length) throw new Error('No active golden dataset cases found. Add cases first.')

  // 2. Create the run record up-front (status: running)
  const { data: run, error: runErr } = await supabase.from('eval_runs').insert({
    run_name: runName || `Run ${new Date().toLocaleString()}`,
    model: MODEL,
    prompt_version: promptVersion,
    case_type_filter: caseTypeFilter,
    status: 'running',
    total_cases: cases.length,
    created_by: userId,
  }).select().single()
  if (runErr) throw runErr

  // 3. Execute cases sequentially
  const results = []
  let done = 0
  for (const c of cases) {
    const label = c.case_type === 'image' ? `📸 ${c.image_url?.slice(-30)}` : `💬 ${c.text_input?.slice(0, 40)}`
    onProgress?.({ done, total: cases.length, current: label })

    const started = performance.now()
    let row = {
      run_id: run.id,
      case_id: c.id,
      status: 'ok',
    }
    try {
      const raw = c.case_type === 'image'
        ? await runImageCase(c.image_url)
        : await estimateFromText(c.text_input)
      const pred = extractPrediction(raw)
      const absErr = Math.abs(Math.round(pred.kcal) - c.true_kcal)
      row = {
        ...row,
        predicted_kcal: Math.round(pred.kcal),
        predicted_protein_g: pred.protein_g,
        predicted_carbs_g: pred.carbs_g,
        predicted_fat_g: pred.fat_g,
        ai_confidence: pred.confidence,
        raw_response: raw,
        abs_error_kcal: absErr,
        // Guard divide-by-zero for 0-kcal ground truth (e.g. water):
        pct_error: c.true_kcal > 0 ? Number(((absErr / c.true_kcal) * 100).toFixed(2)) : (absErr > 20 ? 100 : 0),
        latency_ms: Math.round(performance.now() - started),
      }
    } catch (err) {
      row = {
        ...row,
        status: err?.code === 'TIMEOUT' ? 'timeout'
             : err?.code === 'PARSE_ERROR' ? 'parse_error'
             : err?.code === 'EMPTY_RESPONSE' ? 'empty' : 'api_error',
        error_message: err?.message?.slice(0, 500) ?? 'Unknown error',
        latency_ms: Math.round(performance.now() - started),
      }
    }
    await supabase.from('eval_results').insert(row)
    results.push(row)
    done++
    onProgress?.({ done, total: cases.length, current: label })
    if (done < cases.length) await sleep(CASE_DELAY_MS)
  }

  // 4. Compute aggregates from successful results
  const ok = results.filter(r => r.status === 'ok' && r.pct_error !== undefined)
  const mae  = ok.length ? ok.reduce((s, r) => s + r.abs_error_kcal, 0) / ok.length : null
  const mape = ok.length ? ok.reduce((s, r) => s + Number(r.pct_error), 0) / ok.length : null
  const avgConf = ok.filter(r => r.ai_confidence != null).length
    ? ok.reduce((s, r) => s + Number(r.ai_confidence ?? 0), 0) / ok.filter(r => r.ai_confidence != null).length
    : null
  // Confidence calibration: correlate confidence with (negative) error.
  const withConf = ok.filter(r => r.ai_confidence != null)
  const corr = pearson(
    withConf.map(r => Number(r.ai_confidence)),
    withConf.map(r => -Number(r.pct_error)) // higher confidence should mean lower error
  )
  const avgLatency = results.length
    ? Math.round(results.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / results.length)
    : null

  // 5. Finalise the run record
  await supabase.from('eval_runs').update({
    status: 'completed',
    completed_cases: ok.length,
    failed_cases: results.length - ok.length,
    mae_kcal: mae !== null ? Number(mae.toFixed(2)) : null,
    mape_pct: mape !== null ? Number(mape.toFixed(2)) : null,
    avg_confidence: avgConf !== null ? Number(avgConf.toFixed(3)) : null,
    confidence_correlation: corr,
    avg_latency_ms: avgLatency,
    completed_at: new Date().toISOString(),
  }).eq('id', run.id)

  return run.id
}

/** Fetch dashboard aggregates: latest run + trend across runs */
export async function fetchEvalDashboard() {
  const [{ data: runs }, { data: datasetStats }] = await Promise.all([
    supabase.from('eval_runs')
      .select('*')
      .eq('status', 'completed')
      .order('started_at', { ascending: false })
      .limit(20),
    supabase.from('golden_dataset')
      .select('case_type, category, is_active'),
  ])
  return { runs: runs ?? [], datasetStats: datasetStats ?? [] }
}

/** Fetch full per-case breakdown for a specific run */
export async function fetchRunDetail(runId) {
  const [{ data: run }, { data: results }] = await Promise.all([
    supabase.from('eval_runs').select('*').eq('id', runId).single(),
    supabase.from('eval_results')
      .select('*, golden_dataset(text_input, image_url, case_type, true_kcal, source, category, difficulty)')
      .eq('run_id', runId)
      .order('pct_error', { ascending: false, nullsFirst: false }),
  ])
  return { run, results: results ?? [] }
}

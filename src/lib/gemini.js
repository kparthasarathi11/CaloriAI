/**
 * CalorAI — Gemini Vision API client
 * Handles image-based meal analysis and text-based calorie estimation
 */

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const TIMEOUT_MS = 15_000
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convert File/Blob to base64 string */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/** Validate image file before upload */
export function validateImageFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) {
    return { ok: false, error: 'Please upload a JPEG, PNG, or WebP photo. HEIC is not supported.' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: 'Photo is too large (max 10MB). Try compressing it first.' }
  }
  return { ok: true }
}

/** Fetch with timeout + abort */
async function fetchWithTimeout(url, options, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new GeminiError('Request timed out — please try again.', 'TIMEOUT')
    }
    throw new GeminiError('No internet connection — check your network.', 'NETWORK')
  } finally {
    clearTimeout(timer)
  }
}

/** Parse and validate Gemini response JSON */
function parseGeminiJson(text) {
  // Strip markdown code fences if present
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try {
    const data = JSON.parse(clean)
    // Validate expected shape
    if (typeof data !== 'object' || !Array.isArray(data.items)) {
      throw new Error('Unexpected shape')
    }
    return data
  } catch {
    throw new GeminiError(
      'Unexpected AI response — please try logging manually.',
      'PARSE_ERROR'
    )
  }
}

/** Handle HTTP error codes from Gemini */
async function handleHttpError(response) {
  let body = {}
  try { body = await response.json() } catch { /* ignore */ }
  const code = body?.error?.status || response.status

  const map = {
    400: 'Photo format not supported by AI.',
    403: 'AI API key is invalid — check VITE_GEMINI_API_KEY.',
    429: 'AI is busy right now — try again in a moment.',
    500: 'AI service error — use manual entry.',
    503: 'AI service unavailable — use manual entry.',
  }
  throw new GeminiError(
    map[response.status] || `AI error (${response.status}) — use manual entry.`,
    String(code)
  )
}

// ── Custom Error ─────────────────────────────────────────────────────────────

export class GeminiError extends Error {
  constructor(message, code = 'UNKNOWN') {
    super(message)
    this.name = 'GeminiError'
    this.code = code
  }
}

// ── Image Scan ───────────────────────────────────────────────────────────────

/**
 * Analyse a meal photo with Gemini Vision.
 * @param {File} file - Image file from input or camera
 * @returns {{ items: Array, total_kcal: number, confidence: number }}
 */
export async function analyseMealPhoto(file) {
  if (!API_KEY) throw new GeminiError('Gemini API key is not configured.', 'NO_KEY')

  const validation = validateImageFile(file)
  if (!validation.ok) throw new GeminiError(validation.error, 'INVALID_FILE')

  const base64 = await fileToBase64(file)
  const mimeType = file.type

  const prompt = `You are a nutrition expert. Analyse this meal photo carefully.
Return ONLY valid JSON with NO markdown, NO explanation, NO extra text.

Format:
{
  "items": [
    { "name": "food name", "portion": "e.g. 1 cup", "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0 }
  ],
  "total_kcal": 0,
  "confidence": 0.0
}

Rules:
- confidence is 0.0–1.0 (how confident you are this is food and portions are accurate)
- If you cannot identify food, return { "items": [], "total_kcal": 0, "confidence": 0 }
- All numbers must be integers or one decimal place
- Portion should be human-readable (e.g. "1 cup", "2 pieces", "150g")
- Be conservative with estimates — it is better to under-estimate than over-estimate`

  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
  }

  const response = await fetchWithTimeout(
    `${GEMINI_URL}?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) await handleHttpError(response)

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new GeminiError('Empty AI response — try again.', 'EMPTY_RESPONSE')

  return parseGeminiJson(text)
}

// ── Text Estimation ──────────────────────────────────────────────────────────

/**
 * Estimate calories from a text description of food.
 * @param {string} description - e.g. "2 idli with sambar and coconut chutney"
 * @returns {{ kcal: number, protein_g: number, carbs_g: number, fat_g: number, food_name: string }}
 */
export async function estimateFromText(description) {
  if (!API_KEY) throw new GeminiError('Gemini API key is not configured.', 'NO_KEY')
  if (!description?.trim()) throw new GeminiError('Please describe what you ate.', 'EMPTY_INPUT')

  const prompt = `You are a nutrition expert. Estimate the nutritional content of this food description.

Food: "${description.trim()}"

Return ONLY valid JSON with NO markdown:
{
  "food_name": "clean food name",
  "kcal": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0
}

Rules:
- Be conservative — estimate the most common portion if not specified
- food_name should be a clean, formatted name for display
- All numbers must be integers`

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
  }

  const response = await fetchWithTimeout(
    `${GEMINI_URL}?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) await handleHttpError(response)

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new GeminiError('Empty AI response — try again.', 'EMPTY_RESPONSE')

  return parseGeminiJson(text)
}

/**
 * CalorAI — Groq Vision API client
 * Replaces Gemini — uses Groq free tier (llama-4-scout vision model)
 * Free tier: generous daily limits, no credit card needed
 * Sign up: https://console.groq.com
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const API_KEY = import.meta.env.VITE_GROQ_API_KEY
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

/** Parse and validate Groq response JSON */
function parseGroqJson(text) {
  // Strip markdown code fences if present
  const clean = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
  try {
    const data = JSON.parse(clean)
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

/** Handle HTTP error codes from Groq */
async function handleHttpError(response) {
  let body = {}
  try { body = await response.json() } catch { /* ignore */ }

  const map = {
    400: 'Invalid request — please try again.',
    401: 'Groq API key is invalid — check VITE_GROQ_API_KEY in Vercel.',
    413: 'Photo is too large for AI — try a smaller image.',
    429: 'AI is busy right now — try again in a moment.',
    500: 'Groq service error — use manual entry.',
    503: 'Groq service unavailable — use manual entry.',
  }
  throw new GeminiError(
    map[response.status] || `AI error (${response.status}) — use manual entry.`,
    String(response.status)
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
 * Analyse a meal photo with Groq Vision (llama-4-scout).
 * @param {File} file - Image file from input or camera
 * @returns {{ items: Array, total_kcal: number, confidence: number }}
 */
export async function analyseMealPhoto(file) {
  if (!API_KEY) {
    throw new GeminiError(
      'Groq API key is not configured. Add VITE_GROQ_API_KEY to Vercel env vars.',
      'NO_KEY'
    )
  }

  const validation = validateImageFile(file)
  if (!validation.ok) throw new GeminiError(validation.error, 'INVALID_FILE')

  const base64 = await fileToBase64(file)
  const mimeType = file.type

  const prompt = `You are a nutrition expert. Carefully analyse this meal photo.
Return ONLY valid JSON with NO markdown, NO explanation, NO extra text.

Format:
{
  "items": [
    {
      "name": "food name",
      "portion": "e.g. 1 cup",
      "kcal": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fat_g": 0
    }
  ],
  "total_kcal": 0,
  "confidence": 0.0
}

Rules:
- confidence is 0.0 to 1.0 (how confident you are the food is identified and portions are accurate)
- If you cannot identify any food, return: {"items":[],"total_kcal":0,"confidence":0}
- All numbers must be integers or one decimal place
- portion should be human-readable e.g. "1 cup", "2 pieces", "150g"
- Be conservative — it is better to under-estimate than over-estimate calories`

  const body = {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 1024,
    temperature: 0.1,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  }

  const response = await fetchWithTimeout(
    GROQ_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) await handleHttpError(response)

  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new GeminiError('Empty AI response — try again.', 'EMPTY_RESPONSE')

  return parseGroqJson(text)
}

// ── Text Estimation ──────────────────────────────────────────────────────────

/**
 * Estimate calories from a text description of food.
 * @param {string} description - e.g. "2 idli with sambar and coconut chutney"
 * @returns {{ kcal: number, protein_g: number, carbs_g: number, fat_g: number, food_name: string }}
 */
export async function estimateFromText(description) {
  if (!API_KEY) {
    throw new GeminiError(
      'Groq API key is not configured. Add VITE_GROQ_API_KEY to Vercel env vars.',
      'NO_KEY'
    )
  }
  if (!description?.trim()) {
    throw new GeminiError('Please describe what you ate.', 'EMPTY_INPUT')
  }

  const prompt = `You are a nutrition expert. Estimate the nutritional content of this food.

Food description: "${description.trim()}"

Return ONLY valid JSON with NO markdown, NO explanation:
{
  "food_name": "clean display name",
  "kcal": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0,
  "items": [
    {
      "name": "food_name",
      "portion": "as described",
      "kcal": 0,
      "protein_g": 0,
      "carbs_g": 0,
      "fat_g": 0
    }
  ],
  "total_kcal": 0,
  "confidence": 0.8
}

Rules:
- Be conservative with estimates
- food_name should be clean and formatted for display
- All numbers must be integers`

  const body = {
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    max_tokens: 512,
    temperature: 0.1,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  }

  const response = await fetchWithTimeout(
    GROQ_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) await handleHttpError(response)

  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new GeminiError('Empty AI response — try again.', 'EMPTY_RESPONSE')

  return parseGroqJson(text)
}

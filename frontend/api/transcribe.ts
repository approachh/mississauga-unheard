/**
 * POST /api/transcribe: speech-to-text through ElevenLabs Scribe.
 * GET  /api/transcribe: reports whether transcription is configured, plus upload limits.
 *
 * Runs as a Vercel serverless function in production and is mounted by a Vite plugin in
 * local dev and preview (see vite.config.ts). The API key is read from the server
 * environment only; it is never sent to the browser.
 *
 * Request:  raw audio bytes as the body, `Content-Type: audio/...`,
 *           optional `X-Language-Code: <ISO 639-1/639-3 code>` (omit or "auto" to detect).
 * Response: { text, language_code, language_probability, model } or { error: { code, message } }.
 *
 * Audio is held in memory for the duration of the request and is never written to disk or logged.
 */

/** Vercel's request-body limit is 4.5 MB; stay below it. Mirrored in src/lib/voice.ts. */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024
const MIN_AUDIO_BYTES = 1024

export const ACCEPTED_AUDIO_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/flac',
  'audio/x-flac',
  'video/webm', // some browsers label MediaRecorder output this way
]

const EXT: Record<string, string> = {
  'audio/webm': 'webm', 'video/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav',
  'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/flac': 'flac', 'audio/x-flac': 'flac',
}

const UPSTREAM_TIMEOUT_MS = 55_000
// One 311 Assistant call makes up to three transcriptions (request, retranscription, address),
// so back-to-back demo runs need room; this still blunts scripted abuse.
const RATE_LIMIT = { windowMs: 60_000, max: 20 }

export const maxDuration = 60

type Env = Record<string, string | undefined>

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  })

const fail = (status: number, code: string, message: string, headers?: Record<string, string>) =>
  json(status, { error: { code, message } }, headers)

// Best-effort per-instance limiter. Serverless instances do not share memory, so this only
// blunts bursts from one client; ElevenLabs' own 429s are handled below.
const hits = new Map<string, number[]>()
function rateLimited(ip: string): number | null {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs)
  if (recent.length >= RATE_LIMIT.max) {
    hits.set(ip, recent)
    return Math.ceil((RATE_LIMIT.windowMs - (now - recent[0])) / 1000)
  }
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return null
}

export function handleStatus(env: Env = process.env): Response {
  return json(200, {
    configured: Boolean(env.ELEVENLABS_API_KEY),
    maxBytes: MAX_AUDIO_BYTES,
    acceptedTypes: ACCEPTED_AUDIO_TYPES,
  })
}

export async function handleTranscribe(request: Request, env: Env = process.env): Promise<Response> {
  const apiKey = env.ELEVENLABS_API_KEY
  if (!apiKey) return fail(503, 'not_configured', 'Transcription is not configured on this server.')

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local'
  const wait = rateLimited(ip)
  if (wait !== null)
    return fail(429, 'rate_limited', `Too many requests. Try again in ${wait} seconds.`, { 'Retry-After': String(wait) })

  const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  if (!ACCEPTED_AUDIO_TYPES.includes(type))
    return fail(415, 'unsupported_type', 'Unsupported audio format. Use WebM, OGG, MP3, M4A, WAV or FLAC.')

  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_AUDIO_BYTES) return fail(413, 'too_large', 'Audio is larger than 4 MB.')

  const languageHeader = (request.headers.get('x-language-code') ?? 'auto').trim().toLowerCase()
  if (languageHeader !== 'auto' && !/^[a-z]{2,3}$/.test(languageHeader))
    return fail(400, 'invalid_language', 'Language code must be a 2 or 3 letter ISO code.')

  let audio: ArrayBuffer
  try {
    audio = await request.arrayBuffer()
  } catch {
    return fail(400, 'unreadable_body', 'Could not read the uploaded audio.')
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) return fail(413, 'too_large', 'Audio is larger than 4 MB.')
  if (audio.byteLength < MIN_AUDIO_BYTES) return fail(400, 'too_small', 'The recording is empty or too short.')

  const form = new FormData()
  form.append('model_id', env.ELEVENLABS_STT_MODEL || 'scribe_v1')
  form.append('file', new Blob([audio], { type }), `recording.${EXT[type] ?? 'bin'}`)
  if (languageHeader !== 'auto') form.append('language_code', languageHeader)
  form.append('tag_audio_events', 'false')
  form.append('diarize', 'false')

  const base = (env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io').replace(/\/$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  let upstream: Response
  try {
    upstream = await fetch(`${base}/v1/speech-to-text`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
      signal: controller.signal,
    })
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return aborted
      ? fail(504, 'timeout', 'Transcription took too long. Try a shorter recording.')
      : fail(502, 'upstream_unreachable', 'Could not reach the transcription service.')
  } finally {
    clearTimeout(timer)
  }

  if (!upstream.ok) {
    const detail = await readUpstreamDetail(upstream)
    if (upstream.status === 429) {
      const retry = upstream.headers.get('retry-after') ?? '30'
      return fail(429, 'upstream_rate_limited', 'The transcription service is busy. Try again shortly.', { 'Retry-After': retry })
    }
    if (upstream.status === 401 || upstream.status === 403)
      return fail(502, 'upstream_auth', 'The server’s ElevenLabs credentials were rejected.')
    if (upstream.status === 400 || upstream.status === 422)
      return fail(400, 'upstream_rejected', detail ? `ElevenLabs could not process this audio: ${detail}` : 'ElevenLabs could not process this audio.')
    return fail(502, 'upstream_error', `The transcription service returned an error (${upstream.status}).`)
  }

  let data: unknown
  try {
    data = await upstream.json()
  } catch {
    return fail(502, 'upstream_malformed', 'The transcription service returned an unreadable response.')
  }
  const d = data as { text?: unknown; language_code?: unknown; language_probability?: unknown }
  if (typeof d.text !== 'string') return fail(502, 'upstream_malformed', 'The transcription service returned no text field.')

  return json(200, {
    text: d.text,
    language_code: typeof d.language_code === 'string' ? d.language_code : null,
    language_probability: typeof d.language_probability === 'number' ? d.language_probability : null,
    model: env.ELEVENLABS_STT_MODEL || 'scribe_v1',
  })
}

async function readUpstreamDetail(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { detail?: unknown }
    const detail = body.detail
    if (typeof detail === 'string') return detail.slice(0, 200)
    if (detail && typeof detail === 'object' && 'message' in detail && typeof detail.message === 'string')
      return detail.message.slice(0, 200)
  } catch {
    /* body was not JSON */
  }
  return null
}

// Vercel entry points (Web-standard handlers).
export function GET(): Response {
  return handleStatus()
}

export function POST(request: Request): Promise<Response> {
  return handleTranscribe(request)
}

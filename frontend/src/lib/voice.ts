/** Mirrors api/transcribe.ts. The server enforces these; the client checks early for better messages. */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024
export const MAX_RECORDING_SECONDS = 60
export const ACCEPTED_EXTENSIONS = ['webm', 'ogg', 'mp3', 'm4a', 'mp4', 'aac', 'wav', 'flac']

/**
 * Languages offered in the demo: the census home-language ranking plus English.
 * Codes are ISO 639-1 where one exists, otherwise ISO 639-3, as Scribe accepts both.
 */
export const VOICE_LANGUAGES: { code: string; name: string }[] = [
  { code: 'auto', name: 'Detect automatically' },
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'Arabic' },
  { code: 'ur', name: 'Urdu' },
  { code: 'zh', name: 'Mandarin' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'pl', name: 'Polish' },
  { code: 'yue', name: 'Cantonese' },
  { code: 'fil', name: 'Tagalog (Filipino)' },
  { code: 'es', name: 'Spanish' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'ta', name: 'Tamil' },
  { code: 'hi', name: 'Hindi' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'hr', name: 'Croatian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ko', name: 'Korean' },
  { code: 'bn', name: 'Bengali' },
  { code: 'it', name: 'Italian' },
  { code: 'ml', name: 'Malayalam' },
]

/** The service reports ISO 639-3 codes (e.g. "hin"); the picker uses ISO 639-1 (e.g. "hi"). */
const ISO3: Record<string, string> = {
  eng: 'en', ara: 'ar', urd: 'ur', zho: 'zh', cmn: 'zh', pan: 'pa', pol: 'pl', yue: 'yue', fil: 'fil', tgl: 'fil',
  spa: 'es', vie: 'vi', tam: 'ta', hin: 'hi', por: 'pt', guj: 'gu', hrv: 'hr', srp: 'sr', rus: 'ru', ukr: 'uk',
  kor: 'ko', ben: 'bn', ita: 'it', mal: 'ml',
}

export const languageName = (code: string | null | undefined) => {
  const c = code ? (ISO3[code.toLowerCase()] ?? code) : code
  return VOICE_LANGUAGES.find((l) => l.code === c)?.name ?? (code ? code.toUpperCase() : 'Unknown')
}

export interface TranscriptionResponse {
  text: string
  language_code: string | null
  language_probability: number | null
  model: string
}

export class TranscriptionError extends Error {
  code: string
  retryAfter?: number
  constructor(code: string, message: string, retryAfter?: number) {
    super(message)
    this.code = code
    this.retryAfter = retryAfter
  }
}

export interface ServiceStatus {
  configured: boolean
}

export async function getServiceStatus(signal?: AbortSignal): Promise<ServiceStatus | null> {
  try {
    const res = await fetch('/api/transcribe', { signal, cache: 'no-store' })
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null
    const body = (await res.json()) as { configured?: unknown }
    return { configured: body.configured === true }
  } catch {
    return null // endpoint absent (e.g. static hosting) or network error
  }
}

/** Client-side checks before upload. Returns an error message, or null when acceptable. */
export function checkAudio(blob: Blob, name?: string): string | null {
  const ext = name?.split('.').pop()?.toLowerCase()
  const typeOk = blob.type.startsWith('audio/') || blob.type === 'video/webm' || (ext && ACCEPTED_EXTENSIONS.includes(ext))
  if (!typeOk) return 'This file is not a supported audio format. Use WebM, OGG, MP3, M4A, WAV or FLAC.'
  if (blob.size > MAX_AUDIO_BYTES) return `This file is ${(blob.size / 1024 / 1024).toFixed(1)} MB. The limit is 4 MB, about a minute of compressed audio.`
  if (blob.size < 1024) return 'This recording is empty or too short.'
  return null
}

const EXT_TYPES: Record<string, string> = {
  webm: 'audio/webm', ogg: 'audio/ogg', mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4',
  aac: 'audio/aac', wav: 'audio/wav', flac: 'audio/flac',
}

export async function transcribe(audio: Blob, languageCode: string, signal?: AbortSignal, name?: string): Promise<TranscriptionResponse> {
  // Some OSes report uploads with an empty type; derive it from the extension.
  const ext = name?.split('.').pop()?.toLowerCase() ?? ''
  const type = audio.type || EXT_TYPES[ext] || 'application/octet-stream'

  let res: Response
  try {
    res = await fetch('/api/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': type, 'X-Language-Code': languageCode },
      body: audio,
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new TranscriptionError('network', 'Could not reach the server. Check your connection and try again.')
  }

  const isJson = res.headers.get('content-type')?.includes('json')
  const body = isJson ? ((await res.json()) as unknown) : null

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error
    const retry = Number(res.headers.get('retry-after')) || undefined
    if (!err) throw new TranscriptionError('no_endpoint', 'The transcription endpoint is not available on this deployment.')
    throw new TranscriptionError(err.code ?? 'unknown', err.message ?? `Request failed (${res.status}).`, retry)
  }
  const b = body as Partial<TranscriptionResponse> | null
  if (!b || typeof b.text !== 'string') throw new TranscriptionError('malformed', 'The server returned an unexpected response.')
  return {
    text: b.text,
    language_code: b.language_code ?? null,
    language_probability: b.language_probability ?? null,
    model: b.model ?? 'unknown',
  }
}

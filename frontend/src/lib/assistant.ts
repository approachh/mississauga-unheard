/**
 * 311 Assistant logic, ported from analysis/src/live_demo.py.
 *
 * Kept from live_demo.py: the language names, the confusable pairs, the 0.80 confidence threshold,
 * and the keyword categories. Changed: live_demo.py only asks the caller to confirm when the
 * detected-language confidence is below 0.80. Our own FLEURS results show that is not enough:
 * when Scribe wrote Urdu as Hindi it was 0.91 to 0.99 confident, and it labelled all 40 Cantonese
 * clips as Chinese with a median confidence of 1.00. So for languages in a confusable pair the
 * assistant always asks; for the rest it asks when confidence is below 0.80.
 *
 * Conversation: when the server has a Groq language model (GROQ_API_KEY), each turn goes through
 * `converse`, which answers in the caller's language, asks follow-up questions and keeps an English
 * request draft. Without it, or if it fails mid-call, the page falls back to the fixed-line flow
 * from live_demo.py (keyword category, ask for the address, done).
 *
 * The fixed lines live on the server (api/assistant.ts), which only speaks those and its own replies.
 */

export const CONFIDENCE_THRESHOLD = 0.8

/** Languages the assistant can answer in: code (as Scribe reports it), English name, native name. */
export const ASSISTANT_LANGUAGES: { code: string; name: string; native: string; html: string }[] = [
  { code: 'eng', name: 'English', native: 'English', html: 'en' },
  { code: 'urd', name: 'Urdu', native: 'اردو', html: 'ur' },
  { code: 'hin', name: 'Hindi', native: 'हिन्दी', html: 'hi' },
  { code: 'pan', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', html: 'pa' },
  { code: 'zho', name: 'Mandarin', native: '普通话', html: 'zh-Hans' },
  { code: 'yue', name: 'Cantonese', native: '廣東話', html: 'yue-Hant' },
  { code: 'ara', name: 'Arabic', native: 'العربية', html: 'ar' },
  { code: 'fil', name: 'Tagalog', native: 'Tagalog', html: 'fil' },
  { code: 'pol', name: 'Polish', native: 'Polski', html: 'pl' },
  { code: 'spa', name: 'Spanish', native: 'Español', html: 'es' },
  { code: 'por', name: 'Portuguese', native: 'Português', html: 'pt' },
  { code: 'vie', name: 'Vietnamese', native: 'Tiếng Việt', html: 'vi' },
  { code: 'tam', name: 'Tamil', native: 'தமிழ்', html: 'ta' },
  { code: 'guj', name: 'Gujarati', native: 'ગુજરાતી', html: 'gu' },
  { code: 'ben', name: 'Bengali', native: 'বাংলা', html: 'bn' },
  { code: 'rus', name: 'Russian', native: 'Русский', html: 'ru' },
]

/** Names for languages Scribe may detect that the assistant cannot answer in. From live_demo.py, extended. */
const OTHER_NAMES: Record<string, string> = {
  ukr: 'Ukrainian', kor: 'Korean', ita: 'Italian', mal: 'Malayalam', hrv: 'Croatian',
  srp: 'Serbian', jpn: 'Japanese', fra: 'French', deu: 'German', fas: 'Persian', tur: 'Turkish',
}

/** Scribe sometimes reports a variant code; fold it into the one the assistant uses. */
const ALIASES: Record<string, string> = {
  cmn: 'zho', tgl: 'fil', en: 'eng', ur: 'urd', hi: 'hin', pa: 'pan', zh: 'zho', ar: 'ara', tl: 'fil',
  fil: 'fil', pl: 'pol', es: 'spa', pt: 'por', vi: 'vie', ta: 'tam', gu: 'guj', bn: 'ben', ru: 'rus',
}

export const normalizeLanguage = (code: string | null | undefined): string | null => {
  if (!code) return null
  const c = code.trim().toLowerCase()
  return ALIASES[c] ?? c
}

export const findLanguage = (code: string | null | undefined) => ASSISTANT_LANGUAGES.find((l) => l.code === code)
export const isSupported = (code: string | null | undefined) => !!findLanguage(code)
export const languageLabel = (code: string | null | undefined) =>
  findLanguage(code)?.name ?? (code ? (OTHER_NAMES[code] ?? code.toUpperCase()) : 'Unknown')
/** BCP 47 tag for the `lang` attribute, so each script renders with the right font and shaping. */
export const htmlLang = (code: string | null | undefined) => findLanguage(code)?.html

/** Pairs our FLEURS tests showed (or that are known) to get confused. From live_demo.py. */
const CONFUSABLE: Record<string, string> = { urd: 'hin', hin: 'urd', pan: 'urd', zho: 'yue', yue: 'zho' }

export type ConfirmReason = 'confusable' | 'uncertain'

export interface ConfirmPlan {
  reason: ConfirmReason
  /** Languages offered as one-tap answers, detected first. */
  options: string[]
  /** Which spoken prompt to use (see api/assistant.ts). */
  pair: string
}

/** Should the assistant ask which language the caller speaks? Returns the plan, or null to go on. */
export function planConfirmation(code: string, probability: number | null): ConfirmPlan | null {
  const other = CONFUSABLE[code]
  if (other) return { reason: 'confusable', options: [code, other], pair: [code, other].sort().join('+') }
  if (probability === null || probability < CONFIDENCE_THRESHOLD) {
    const options = [...new Set([isSupported(code) ? code : null, 'eng'].filter((c): c is string => !!c))]
    return { reason: 'uncertain', options, pair: 'generic' }
  }
  return null
}

/** Keyword categories from live_demo.py, with a few extra English phrasings. */
export const CATEGORIES: { id: string; label: string; words: string[] }[] = [
  {
    id: 'streetlight',
    label: 'Streetlight',
    words: ['streetlight', 'street light', 'light is out', 'lights are out', 'light out', 'lights out', 'lamp',
      'بتی', 'روشنی', 'لائٹ', 'बत्ती', 'लाइट', 'ਬੱਤੀ', 'إنارة', 'مصباح', '路灯', '路燈', 'farola', 'ilaw', 'latarnia',
      'poste', 'đèn', 'விளக்கு', 'фонарь', 'фонар', 'освещени'],
  },
  {
    id: 'road',
    label: 'Pothole / Road',
    words: ['pothole', 'road', 'sidewalk', 'گڑھا', 'سڑک', 'गड्ढा', 'सड़क', 'ਟੋਆ', 'ਸੜਕ', 'حفرة', 'طريق', '坑', '马路',
      '馬路', 'bache', 'calle', 'lubak', 'dziura', 'buraco', 'ổ gà', 'குழி', 'яма', 'ямы', 'дорога', 'дороге', 'тротуар'],
  },
  {
    id: 'garbage',
    label: 'Garbage / Recycling',
    words: ['garbage', 'trash', 'recycling', 'waste', 'کچرا', 'کوڑا', 'कचरा', 'कूड़ा', 'ਕੂੜਾ', 'قمامة', '垃圾', 'basura',
      'śmieci', 'lixo', 'rác', 'குப்பை', 'мусор', 'отходы', 'переработк'],
  },
  {
    id: 'noise',
    label: 'Noise',
    words: ['noise', 'loud', 'شور', 'शोर', 'ਸ਼ੋਰ', 'ضوضاء', '噪音', '嘈', 'ruido', 'ingay', 'hałas', 'barulho', 'ồn', 'சத்தம்', 'шум', 'громк'],
  },
  {
    id: 'water',
    label: 'Water / Flooding',
    words: ['water', 'flood', 'leak', 'پانی', 'पानी', 'ਪਾਣੀ', 'ماء', 'مياه', '水', 'agua', 'tubig', 'woda', 'água', 'nước',
      'தண்ணீர்', 'вода', 'воды', 'воду', 'затоп', 'протечк', 'утечк'],
  },
]
export const GENERAL = { id: 'other', label: 'Other' }

/** Keyword classification for the fallback flow (no language model). */
export function classifyRequest(text: string): { id: string; label: string } {
  const t = text.toLowerCase()
  return CATEGORIES.find((c) => c.words.some((w) => t.includes(w))) ?? GENERAL
}

/** Labels for the categories the language model chooses from (see api/assistant.ts). */
export const DRAFT_CATEGORIES: Record<string, string> = {
  streetlight: 'Streetlight',
  road: 'Pothole / Road',
  sidewalk: 'Sidewalk',
  traffic: 'Traffic signal / Sign',
  snow: 'Snow / Ice',
  garbage: 'Garbage / Recycling',
  water: 'Water',
  drainage: 'Drainage / Flooding',
  noise: 'Noise',
  bylaw: 'By-law / Property standards',
  parking: 'Parking',
  trees: 'Parks / Trees',
  graffiti: 'Graffiti',
  animal: 'Animal services',
  transit: 'MiWay transit',
  other: 'Other',
}

/** Who most likely handles the request: Mississauga shares services with the Region of Peel. */
export const RESPONSIBLE_LABELS: Record<string, string> = {
  city: 'City of Mississauga',
  peel: 'Region of Peel',
  province: 'Province of Ontario',
  utility: 'Utility company',
  police: 'Peel Regional Police (non-emergency)',
  unsure: '311 to direct',
}

// ------------------------------------------------------------------ server calls

export type SayRequest =
  | { line: 'reply' | 'done'; lang: string }
  | { line: 'confirm'; pair: string }
  /** A reply the server wrote in a conversation turn; the token proves it did. */
  | { line: 'text'; text: string; lang: string; token: string }

export interface Draft {
  category: string
  summary: string | null
  location: string | null
  /** False while the assistant is still checking an address it normalised or found ambiguous. */
  locationConfirmed: boolean
  details: string | null
  urgency: 'routine' | 'soon' | 'urgent'
  responsible: string
}

export interface TurnResult {
  reply: string
  replyEn: string
  /** need_info: it asked something. ready: the request draft is complete. closed: done, no request. */
  status: 'need_info' | 'ready' | 'closed'
  emergency: boolean
  /** Null when the conversation is not (or not yet) a service request, e.g. a general question. */
  draft: Draft | null
  speech: { text: string; lang: string; token: string }
  model: string
}

export interface HistoryItem {
  role: 'caller' | 'assistant'
  text: string
}

/** One conversational turn through the language model. Throws AssistantError when no model answers. */
export async function converse(lang: string, history: HistoryItem[], signal?: AbortSignal): Promise<TurnResult> {
  let res: Response
  try {
    res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turn: { lang, history } }),
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new AssistantError('network', 'Could not reach the server.')
  }
  const body = res.headers.get('content-type')?.includes('json') ? ((await res.json()) as Record<string, unknown>) : null
  if (!res.ok || !body) {
    const err = body?.error as { code?: string; message?: string } | undefined
    throw new AssistantError(err?.code ?? 'llm_unavailable', err?.message ?? 'The assistant could not answer.')
  }
  const b = body as unknown as TurnResult
  if (typeof b.reply !== 'string' || !b.speech || typeof b.speech.token !== 'string')
    throw new AssistantError('malformed', 'The server returned an unexpected response.')
  return b
}

export interface SayResult {
  text: string
  /** The text split by language (two-language prompts), each laid out in its own direction. */
  parts: { text: string; lang: string }[]
  gloss: string
  lang: string
  /** Object URL of the spoken MP3, or null when speech failed (the text still works). */
  audioUrl: string | null
  audioError: string | null
}

export class AssistantError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const sayCache = new Map<string, Promise<SayResult>>()
const sayKey = (r: SayRequest) =>
  r.line === 'confirm' ? `confirm:${r.pair}` : r.line === 'text' ? `text:${r.lang}:${r.text}` : `${r.line}:${r.lang}`

/**
 * Fetches one spoken line. Results are cached for the session, so a prefetch turns the later
 * call into an instant one. Failed calls are not cached, so a retry asks the server again.
 */
export function say(req: SayRequest): Promise<SayResult> {
  const key = sayKey(req)
  const hit = sayCache.get(key)
  if (hit) return hit
  const p = fetchLine(req)
  sayCache.set(key, p)
  p.catch(() => sayCache.delete(key))
  return p
}

/** Warm the cache; errors are ignored here and surface on the real call. */
export const prefetch = (req: SayRequest) => void say(req).catch(() => {})

async function fetchLine(req: SayRequest): Promise<SayResult> {
  let res: Response
  try {
    res = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) })
  } catch {
    throw new AssistantError('network', 'Could not reach the server.')
  }
  const body = res.headers.get('content-type')?.includes('json') ? ((await res.json()) as Record<string, unknown>) : null
  if (!res.ok || !body) {
    const err = body?.error as { code?: string; message?: string } | undefined
    throw new AssistantError(err?.code ?? 'unknown', err?.message ?? 'The assistant endpoint is not available on this deployment.')
  }
  if (typeof body.text !== 'string') throw new AssistantError('malformed', 'The server returned an unexpected response.')
  const parts = Array.isArray(body.parts)
    ? (body.parts as unknown[]).filter((p): p is { text: string; lang: string } =>
        !!p && typeof (p as { text?: unknown }).text === 'string' && typeof (p as { lang?: unknown }).lang === 'string')
    : []
  return {
    text: body.text,
    parts: parts.length ? parts : [{ text: body.text, lang: typeof body.lang === 'string' ? body.lang : 'eng' }],
    gloss: typeof body.gloss === 'string' ? body.gloss : '',
    lang: typeof body.lang === 'string' ? body.lang : 'eng',
    audioUrl: typeof body.audio === 'string' ? base64ToUrl(body.audio) : null,
    audioError: typeof body.audioError === 'string' ? body.audioError : null,
  }
}

function base64ToUrl(b64: string): string | null {
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
  } catch {
    return null
  }
}

export interface AssistantStatus {
  configured: boolean
  /** A language model is configured (conversational mode); otherwise the fixed-line flow runs. */
  llm: boolean
  model: string | null
}

export async function getAssistantStatus(signal?: AbortSignal): Promise<AssistantStatus | null> {
  try {
    const res = await fetch('/api/assistant', { signal, cache: 'no-store' })
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null
    const body = (await res.json()) as { configured?: unknown; llm?: unknown; model?: unknown }
    return { configured: body.configured === true, llm: body.llm === true, model: typeof body.model === 'string' ? body.model : null }
  } catch {
    return null
  }
}

/**
 * A few milliseconds of silence. Playing it inside the first tap unlocks audio on browsers
 * (Safari) that otherwise block a reply that starts after an async wait.
 */
export function silentWavUrl(): string {
  const samples = 800
  const buf = new ArrayBuffer(44 + samples * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + samples * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, 16000, true)
  v.setUint32(28, 32000, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, samples * 2, true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

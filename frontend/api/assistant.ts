/**
 * /api/assistant: the 311 Assistant's brain and voice.
 *
 *   GET                          { configured, llm, model }
 *   POST { turn: { lang, history } }
 *        One conversational turn. VOXELO, a Groq-hosted LLM with Mississauga context, reads the
 *        conversation so far, answers in the caller's language, asks follow-up questions (confirming
 *        ambiguous addresses), answers general city-service questions, declines what is out of scope,
 *        and keeps an English request draft up to date. Response:
 *        { reply, replyEn, status: "need_info" | "ready" | "closed", emergency, draft | null,
 *          speech: { text, lang, token }, model }
 *        503 { error: { code: "llm_unavailable" } } when no LLM answered; the page then falls back to its
 *        fixed-line flow.
 *   POST { line: "reply" | "done", lang } | { line: "confirm", pair }
 *        A fixed line (language confirmation, fallback flow), spoken with ElevenLabs Text-to-Speech.
 *   POST { line: "text", text, lang, token }
 *        Speaks a reply this server wrote in an earlier turn. The token is an HMAC the server attached
 *        to that reply, so the endpoint never speaks text a client made up (no open TTS proxy).
 *   Speech responses: { text, parts: [{ text, lang }], gloss, lang, audio: base64 MP3 | null, model, audioError }
 *
 * Runs as a Vercel function and through the Vite plugin locally. API keys stay on the server
 * (ELEVENLABS_API_KEY, GROQ_API_KEY). Nothing is stored and nothing is sent to the City: the prompt
 * and a server-side check keep the assistant from claiming otherwise.
 *
 * Fixed lines come from analysis/src/live_demo.py; the "done" lines were added for the web prototype.
 * All non-English fixed lines are machine-written; have native speakers check them.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

type Env = Record<string, string | undefined>

interface Line {
  text: string
  /** English meaning, shown under the line on the page. */
  gloss: string
}
type Part = { text: string; lang: string }

// ------------------------------------------------------------------ fixed lines

// "Thank you, I understood your request. Please tell me the address."  (live_demo.py REPLIES)
const REPLY_GLOSS = 'Thank you, I understood your request. Please tell me the address.'
const REPLY: Record<string, string> = {
  eng: 'Thank you, I understood your request. Please tell me the address.',
  urd: 'شکریہ، میں آپ کی درخواست سمجھ گیا ہوں۔ براہ کرم مجھے پتہ بتائیں۔',
  hin: 'धन्यवाद, मैंने आपका अनुरोध समझ लिया है। कृपया मुझे पता बताइए।',
  pan: 'ਧੰਨਵਾਦ, ਮੈਂ ਤੁਹਾਡੀ ਬੇਨਤੀ ਸਮਝ ਗਿਆ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਮੈਨੂੰ ਪਤਾ ਦੱਸੋ।',
  ara: 'شكرًا، لقد فهمت طلبك. من فضلك أخبرني بالعنوان.',
  zho: '谢谢，我已经了解您的请求。请告诉我地址。',
  yue: '多謝，我明白你嘅要求。請話我知地址。',
  fil: 'Salamat, naintindihan ko ang iyong kahilingan. Pakisabi po ang address.',
  spa: 'Gracias, entendí su solicitud. Por favor, dígame la dirección.',
  pol: 'Dziękuję, zrozumiałem Pana/Pani zgłoszenie. Proszę podać adres.',
  por: 'Obrigado, percebi o seu pedido. Por favor, diga-me a morada.',
  vie: 'Cảm ơn, tôi đã hiểu yêu cầu của bạn. Vui lòng cho tôi biết địa chỉ.',
  tam: 'நன்றி, உங்கள் கோரிக்கையை புரிந்துகொண்டேன். தயவுசெய்து முகவரியைச் சொல்லுங்கள்.',
  guj: 'આભાર, હું તમારી વિનંતી સમજી ગયો છું. કૃપા કરીને મને સરનામું જણાવો.',
  ben: 'ধন্যবাদ, আমি আপনার অনুরোধ বুঝেছি। অনুগ্রহ করে আমাকে ঠিকানাটি বলুন।',
}

// "Thank you. Your request draft is ready."  Worded so it never suggests anything was submitted.
const DONE_GLOSS = 'Thank you. Your request draft is ready.'
const DONE: Record<string, string> = {
  eng: 'Thank you. Your request draft is ready.',
  urd: 'شکریہ۔ آپ کی درخواست کا مسودہ تیار ہے۔',
  hin: 'धन्यवाद। आपके अनुरोध का मसौदा तैयार है।',
  pan: 'ਧੰਨਵਾਦ। ਤੁਹਾਡੀ ਬੇਨਤੀ ਦਾ ਖਰੜਾ ਤਿਆਰ ਹੈ।',
  ara: 'شكرًا لك. مسودة طلبك جاهزة.',
  zho: '谢谢。您的请求草稿已准备好。',
  yue: '多謝。你嘅要求草稿已經準備好。',
  fil: 'Salamat. Handa na ang draft ng iyong kahilingan.',
  spa: 'Gracias. El borrador de su solicitud está listo.',
  pol: 'Dziękuję. Projekt zgłoszenia jest gotowy.',
  por: 'Obrigado. O rascunho do seu pedido está pronto.',
  vie: 'Cảm ơn. Bản nháp yêu cầu của bạn đã sẵn sàng.',
  tam: 'நன்றி. உங்கள் கோரிக்கையின் வரைவு தயாராக உள்ளது.',
  guj: 'આભાર. તમારી વિનંતીનો ડ્રાફ્ટ તૈયાર છે.',
  ben: 'ধন্যবাদ। আপনার অনুরোধের খসড়া প্রস্তুত।',
}

// "Do you speak X or Y?" asked in both languages  (live_demo.py CONFIRM_PROMPTS). One part per
// language, so the page can lay out right-to-left and left-to-right scripts on their own lines.
const confirmLine = (parts: Part[], gloss: string): Line & { parts: Part[] } => ({ text: parts.map((p) => p.text).join(' '), gloss, parts })
const CONFIRM: Record<string, Line & { parts: Part[] }> = {
  'hin+urd': confirmLine([{ text: 'کیا آپ اردو بولتے ہیں؟', lang: 'urd' }, { text: 'क्या आप हिंदी बोलते हैं?', lang: 'hin' }], 'Do you speak Urdu? Do you speak Hindi?'),
  'pan+urd': confirmLine([{ text: 'ਕੀ ਤੁਸੀਂ ਪੰਜਾਬੀ ਬੋਲਦੇ ਹੋ?', lang: 'pan' }, { text: 'کیا آپ اردو بولتے ہیں؟', lang: 'urd' }], 'Do you speak Punjabi? Do you speak Urdu?'),
  'yue+zho': confirmLine([{ text: '請問你講廣東話定普通話？', lang: 'yue' }, { text: '请问您说普通话还是粤语？', lang: 'zho' }], 'Do you speak Cantonese or Mandarin? (asked in both)'),
  generic: confirmLine([{ text: 'Which language do you speak?', lang: 'eng' }], 'Which language do you speak?'),
}

// ------------------------------------------------------------------ languages

/** Name for the prompt, and a character range the reply must use (checked after the LLM answers). */
const LANGS: Record<string, { name: string; script?: RegExp }> = {
  eng: { name: 'English', script: /[A-Za-z]/ },
  urd: { name: 'Urdu (Nastaliq / Arabic script, not Devanagari)', script: /[؀-ۿ]/ },
  hin: { name: 'Hindi (Devanagari script)', script: /[ऀ-ॿ]/ },
  pan: { name: 'Punjabi (Gurmukhi script)', script: /[਀-੿]/ },
  ara: { name: 'Arabic', script: /[؀-ۿ]/ },
  zho: { name: 'Mandarin Chinese (Simplified characters)', script: /[一-鿿]/ },
  yue: { name: 'Cantonese (written Cantonese, Traditional characters)', script: /[一-鿿]/ },
  fil: { name: 'Tagalog (Filipino)', script: /[A-Za-z]/ },
  spa: { name: 'Spanish', script: /[A-Za-zÁÉÍÓÚÑáéíóúñ]/ },
  pol: { name: 'Polish', script: /[A-Za-ząćęłńóśźż]/ },
  por: { name: 'European Portuguese', script: /[A-Za-zãõçáéíóú]/ },
  vie: { name: 'Vietnamese', script: /[A-Za-zăâđêôơư]/ },
  tam: { name: 'Tamil (Tamil script)', script: /[஀-௿]/ },
  guj: { name: 'Gujarati (Gujarati script)', script: /[઀-૿]/ },
  ben: { name: 'Bengali (Bengali script)', script: /[ঀ-৿]/ },
}

/** Languages the standard multilingual TTS model does not cover; they use the extended model. */
const EXTENDED_LANGS = new Set(['urd', 'pan', 'guj', 'ben', 'vie', 'yue'])

const CATEGORY_IDS = ['streetlight', 'road', 'sidewalk', 'traffic', 'snow', 'garbage', 'water', 'drainage', 'noise', 'bylaw', 'parking', 'trees', 'graffiti', 'animal', 'transit', 'other'] as const
const RESPONSIBLE = ['city', 'peel', 'province', 'utility', 'police', 'unsure'] as const
const URGENCY = ['routine', 'soon', 'urgent'] as const

// ------------------------------------------------------------------ settings

const DEFAULT_VOICE = 'JBFqnCBsd6RMkjVDRZzb'
const DEFAULT_TTS_MODEL = 'eleven_multilingual_v2'
const DEFAULT_TTS_MODEL_EXTENDED = 'eleven_v3'
const DEFAULT_LLM = 'openai/gpt-oss-120b'
/** Tried in order when the main model fails or hits Groq's free-tier limits (each model has its own). */
const DEFAULT_LLM_FALLBACKS = 'qwen/qwen3.8-27b,openai/gpt-oss-20b'
const TTS_TIMEOUT_MS = 25_000
const LLM_TIMEOUT_MS = 12_000
/** After this many caller messages the assistant must finish (address confirmation needs a turn). */
const MAX_CALLER_TURNS = 5
const MAX_HISTORY = 12
const MAX_MESSAGE_CHARS = 600
const MAX_REPLY_CHARS = 320
const RATE_LIMIT = { windowMs: 60_000, max: 40 }
const CACHE_MAX = 96

export const maxDuration = 60

// ------------------------------------------------------------------ helpers

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  })

const fail = (status: number, code: string, message: string, headers?: Record<string, string>) =>
  json(status, { error: { code, message } }, headers)

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

const signingKey = (env: Env) => env.ASSISTANT_SIGNING_SECRET || createHash('sha256').update(`voxelo-speech|${env.ELEVENLABS_API_KEY ?? ''}`).digest('hex')
const sign = (env: Env, lang: string, text: string) => createHmac('sha256', signingKey(env)).update(`${lang}\n${text}`).digest('hex')
function verify(env: Env, lang: string, text: string, token: string): boolean {
  const expected = Buffer.from(sign(env, lang, text), 'hex')
  const given = Buffer.from(/^[0-9a-f]{64}$/.test(token) ? token : '', 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

const clip = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, max) : null
}

/** A draft field the model filled with a non-answer is shown as empty instead. */
const FILLER = /\b(unspecified|unknown|not (given|provided|specified|mentioned|stated)|n\/a|none given)\b/i
/** Letters outside the Latin script: draft fields are for English-reading City staff. */
const NON_LATIN = /[^ -ɏḀ-ỿ -⁯₠-⃏]/
const fact = (v: unknown, max: number) => {
  const s = clip(v, max)
  return s && !FILLER.test(s) && !NON_LATIN.test(s) ? s : null
}

// ------------------------------------------------------------------ status

export function handleAssistantStatus(env: Env = process.env): Response {
  return json(200, {
    configured: Boolean(env.ELEVENLABS_API_KEY),
    llm: Boolean(env.GROQ_API_KEY),
    model: env.GROQ_API_KEY ? env.GROQ_MODEL || DEFAULT_LLM : null,
  })
}

// ------------------------------------------------------------------ entry

export async function handleAssistant(request: Request, env: Env = process.env): Promise<Response> {
  if (!env.ELEVENLABS_API_KEY) return fail(503, 'not_configured', 'The assistant is not configured on this server.')

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local'
  const wait = rateLimited(ip)
  if (wait !== null)
    return fail(429, 'rate_limited', `Too many requests. Try again in ${wait} seconds.`, { 'Retry-After': String(wait) })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail(400, 'invalid_body', 'Send JSON.')
  }
  if (body && typeof body === 'object' && 'turn' in body) return handleTurn((body as { turn: unknown }).turn, env)
  return handleSpeech(body, env)
}

// ------------------------------------------------------------------ conversation turn

type Responsible = (typeof RESPONSIBLE)[number]

interface Draft {
  category: (typeof CATEGORY_IDS)[number]
  summary: string | null
  location: string | null
  /** False while the assistant is still checking an address it normalised or found ambiguous. */
  locationConfirmed: boolean
  details: string | null
  urgency: (typeof URGENCY)[number]
  /** Which public body most likely handles it. Mississauga splits services with the Region of Peel. */
  responsible: Responsible
}

/**
 * What the model knows about Mississauga. Kept short on purpose: Groq's free tier allows 8,000
 * tokens a minute per model, and every turn resends the prompt. Only facts we are sure of; the
 * model is told not to invent anything more specific.
 */
const MISSISSAUGA = `Mississauga facts (do not invent anything more specific):
- City in the Region of Peel, Ontario, west of Toronto; 11 wards. Areas include Malton, Meadowvale, Streetsville, Port Credit, Cooksville, Erin Mills, Churchill Meadows, Clarkson, City Centre (Square One).
- Long roads that also run into Toronto or Brampton (Hurontario, Dundas, Eglinton, Burnhamthorpe, Bloor, Lakeshore, The Queensway, Mavis, Dixie, Airport Road): a road name alone is not a location; ask for the house number or nearest cross street.
- 311 (905-615-4311 from outside the city) and mississauga.ca are the official channels; Region of Peel services also have peelregion.ca. Danger to life: 911.
- Responsible ("responsible" value):
  city = City of Mississauga: roads, potholes, sidewalks, streetlights, traffic signals and signs, snow clearing, storm drains, parking, by-laws (noise, property standards), city parks and trees, graffiti, animal services, MiWay transit, property tax.
  peel = Region of Peel: garbage, recycling, organics and bins; drinking water, water mains, sanitary sewers.
  province = 400-series highways and the QEW. utility = power (Alectra), gas (Enbridge). police = Peel Regional Police, non-emergency.
  unsure = not sure; say 311 can direct them.`

function systemPrompt(lang: string, callerTurns: number): string {
  const name = LANGS[lang]?.name ?? 'English'
  const first = callerTurns === 1
  const last = callerTurns >= MAX_CALLER_TURNS
  return `You are VOXELO, a multilingual voice assistant helping Mississauga (Ontario, Canada) residents with city services and 311 request drafts. You are an independent prototype, not an official City of Mississauga service; you cannot see City records and nothing is sent anywhere. Say so plainly if asked.
Tone: a friendly, efficient city service representative; warm, brief, plain words (many callers are newcomers).
The caller speaks ${name}, through speech recognition: expect transcription errors, spelled-out numbers and phonetic street names.

${MISSISSAUGA}

Tasks:
1. Service request: get the problem, a location staff could find (house number + street, an intersection, or a named park/plaza/school), and one useful detail only if it matters (duration, safety hazard). Then finish.
2. Confirm, never guess: if you normalised the location (spelled-out number, phonetic street) or it could mean two places, read it back and ask the caller to confirm (location_confirmed false). After they confirm, set true and do not ask again.
3. General questions about city services: answer briefly from the facts above, and say which body runs the service when it is not the City (for example, garbage and water are the Region of Peel); never invent dates, schedules, fees, rules, phone numbers or websites beyond those above; otherwise point to 311 or mississauga.ca. Then ask if there is anything to report.
4. Out of scope (immigration, income tax, health cards, licences, private disputes, legal or medical advice, other cities): say kindly it is outside what you can help with and offer help with Mississauga city services.
5. Danger to anyone (fire, smoke, gas smell, crime in progress, injury, downed power lines): emergency true; tell them to call 911 now.

"reply" is spoken by text-to-speech: only ${name}, one or two short sentences, at most 35 words, one question at a time, no lists, markdown or URLs (say "mississauga dot ca").${first ? ' This is your first reply: begin with "Hi, this is VOXELO" (in ' + name + ').' : ''}
Status: "need_info" while you ask something; "ready" when the request draft is complete (thank them, restate problem and place, say the draft is ready; do not mention sending: the system adds a prototype notice); "closed" when they are done and there is no request (short goodbye, no question).
Never say or imply anything was submitted, sent, filed, registered, recorded or reported, in any language; no reference numbers; never promise a repair, visit or time. Use only what the caller said.

"draft" is for City staff. Write every draft field in English, even when the caller speaks another language (null if there is no service request):
category: one of ${CATEGORY_IDS.join(', ')}. summary: one sentence or null. location: as staff would write it, digits for numbers (Urdu "پینتالیس"/"Penthalis" = 45), known street spellings fixed ("Heron Ontario" = Hurontario Street), nothing added the caller did not say; or null. location_confirmed: boolean. details: facts the caller gave, or null (never "unspecified"). urgency: urgent (safety hazard) | soon | routine. responsible: ${RESPONSIBLE.join(' | ')}.

Caller message ${callerTurns} of at most ${MAX_CALLER_TURNS}.${last ? ' Last message: finish now ("ready" with a request, else "closed"); ask nothing.' : ''}
Reply with only this JSON:
{"reply": string, "reply_en": string, "status": "need_info"|"ready"|"closed", "emergency": boolean, "has_request": boolean, "draft": {"category", "summary", "location", "location_confirmed", "details", "urgency", "responsible"} | null}`
}

/**
 * Phrases that would claim a submission, checked on the English version of the reply.
 * Negated phrases ("nothing is sent") are removed first: they are the honest version.
 */
const CLAIMS =
  /\b(submit(ted|ting)?|sent|forward(ed)?|filed|register(ed)?|recorded|logged|lodged|reported to|dispatch(ed)?|(created|opened) a (ticket|case|request)|reference (number|no)|ticket number|case number|crew (is|will)|someone will (come|visit))\b/i
const NEGATED = /\b(not|never|nothing|no|isn't|aren't|won't|doesn't|don't|can't|cannot)\b[^.!?]{0,40}/gi
const claimsInEnglish = (s: string) => CLAIMS.test(s.replace(NEGATED, ' '))

/**
 * The same claims in the caller's language, checked on the closing reply itself: the model's
 * English version can soften them (Hindi "दर्ज की गई" = "registered" came back as "noted").
 */
const NATIVE_CLAIMS = new RegExp(
  [
    // Narrow forms only: a bare "जमा" / "جمع" also means "collected", as in standing water.
    'दर्ज', 'भेज दिया', 'भेजा गया', 'जमा कर दिया', 'जमा हो गया है आपका', // Hindi
    'درج', 'بھیج دی', 'جمع کرا دی', 'جمع کر دی', 'تم تسجيل', 'تم إرسال', 'تم تقديم', // Urdu, Arabic
    'ਦਰਜ', 'ਭੇਜ ਦਿੱਤ', // Punjabi
    '已提交', '已登记', '已登記', '已记录', '已記錄', '已发送', '已發送', '已经提交', '已經提交', // Chinese
    'registrad', 'enviad', 'presentad', 'submetid', // Spanish, Portuguese
    'zarejestrowan', 'wysłan', 'przekazan', // Polish
    'naisumite', 'naipadala', 'nairehistro', // Tagalog
    'đã gửi', 'đã đăng ký', 'đã ghi nhận', // Vietnamese
    'பதிவு செய்யப்பட்ட', 'அனுப்பப்பட்ட', // Tamil
    'નોંધાઈ', 'નોંધવામાં આવ', 'મોકલી દેવા', // Gujarati
    'নথিভুক্ত', 'পাঠানো হয়েছে', 'জমা দেওয়া হয়েছে', // Bengali
  ].join('|'),
  'i',
)

/** Added by the server to every completed draft, so the caller hears it in their own language. */
const PROTOTYPE_GLOSS = 'This is a prototype, so nothing is sent to the City.'
const PROTOTYPE_NOTE: Record<string, string> = {
  eng: 'This is a prototype, so nothing is sent to the City.',
  urd: 'یہ ایک تجرباتی نمونہ ہے، اس لیے شہر کو کچھ نہیں بھیجا جاتا۔',
  hin: 'यह एक प्रोटोटाइप है, इसलिए शहर को कुछ भी नहीं भेजा जाता।',
  pan: 'ਇਹ ਇੱਕ ਪ੍ਰੋਟੋਟਾਈਪ ਹੈ, ਇਸ ਲਈ ਸ਼ਹਿਰ ਨੂੰ ਕੁਝ ਵੀ ਨਹੀਂ ਭੇਜਿਆ ਜਾਂਦਾ।',
  ara: 'هذا نموذج تجريبي، لذلك لا يُرسل أي شيء إلى المدينة.',
  zho: '这是一个原型，所以不会向市政府发送任何内容。',
  yue: '呢個係原型，所以唔會將任何嘢交俾市政府。',
  fil: 'Isa itong prototype, kaya walang ipinapadala sa Lungsod.',
  spa: 'Esto es un prototipo, así que no se envía nada a la Ciudad.',
  pol: 'To jest prototyp, więc nic nie jest wysyłane do miasta.',
  por: 'Isto é um protótipo, por isso nada é enviado à Câmara Municipal.',
  vie: 'Đây là bản thử nghiệm, nên không có gì được gửi đến Thành phố.',
  tam: 'இது ஒரு முன்மாதிரி, எனவே நகரத்திற்கு எதுவும் அனுப்பப்படாது.',
  guj: 'આ એક પ્રોટોટાઇપ છે, તેથી શહેરને કંઈ મોકલવામાં આવતું નથી.',
  ben: 'এটি একটি প্রোটোটাইপ, তাই শহরে কিছুই পাঠানো হয় না।',
}

async function handleTurn(input: unknown, env: Env): Promise<Response> {
  if (!env.GROQ_API_KEY) return fail(503, 'llm_unavailable', 'No language model is configured.')
  const t = (input ?? {}) as { lang?: unknown; history?: unknown }
  const lang = typeof t.lang === 'string' && LANGS[t.lang] ? t.lang : 'eng'
  if (!Array.isArray(t.history) || t.history.length === 0) return fail(400, 'invalid_history', 'history must be a non-empty array.')
  const history = t.history
    .slice(-MAX_HISTORY)
    .map((m) => {
      const msg = m as { role?: unknown; text?: unknown }
      const text = clip(msg.text, MAX_MESSAGE_CHARS)
      return text && (msg.role === 'caller' || msg.role === 'assistant') ? { role: msg.role, text } : null
    })
    .filter((m): m is { role: 'caller' | 'assistant'; text: string } => m !== null)
  if (!history.length || history[history.length - 1].role !== 'caller')
    return fail(400, 'invalid_history', 'The last message must be from the caller.')

  const callerTurns = history.filter((m) => m.role === 'caller').length
  const messages = [
    { role: 'system', content: systemPrompt(lang, callerTurns) },
    ...history.map((m) => ({ role: m.role === 'caller' ? 'user' : 'assistant', content: m.text })),
  ]

  const models = [env.GROQ_MODEL || DEFAULT_LLM, ...(env.GROQ_FALLBACK_MODELS ?? DEFAULT_LLM_FALLBACKS).split(',')]
    .map((m) => m.trim())
    .filter((m, i, a) => m && a.indexOf(m) === i)
  let fallback: { turn: Turn; model: string } | null = null
  for (const [i, model] of models.entries()) {
    const raw = await callGroq(env.GROQ_API_KEY, model, messages)
    if (!raw) continue
    const turn = shapeTurn(raw, lang, callerTurns)
    if (!turn) continue
    // A reply in the wrong language: let the next model try before using a fixed line.
    if (turn.wrongScript && i < models.length - 1) {
      fallback ??= { turn, model }
      continue
    }
    return respond(env, lang, turn, model)
  }
  if (fallback) return respond(env, lang, fallback.turn, fallback.model)
  return fail(503, 'llm_unavailable', 'The language model did not answer.')
}

type Turn = NonNullable<ReturnType<typeof shapeTurn>>

function respond(env: Env, lang: string, turn: Turn, model: string): Response {
  let { reply, replyEn } = turn
  // Every completed draft ends with the prototype notice, in the caller's language.
  if (turn.status === 'ready' && turn.draft) {
    reply = `${reply} ${PROTOTYPE_NOTE[lang] ?? PROTOTYPE_NOTE.eng}`
    replyEn = `${replyEn} ${PROTOTYPE_GLOSS}`
  }
  const { wrongScript: _ignored, ...rest } = turn
  void _ignored
  return json(200, { ...rest, reply, replyEn, model, speech: { text: reply, lang, token: sign(env, lang, reply) } })
}

async function callGroq(apiKey: string, model: string, messages: { role: string; content: string }[]): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        // Groq counts this reservation against the per-minute token limit, so keep it tight.
        max_completion_tokens: 700,
        response_format: { type: 'json_object' },
        // gpt-oss models think before answering; keep it short for a phone-speed reply.
        ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.warn(`[assistant] Groq ${model} returned ${res.status}: ${detail.slice(0, 200)}`)
      return null
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    return content ? JSON.parse(content) : null
  } catch (e) {
    console.warn(`[assistant] Groq ${model} failed:`, e instanceof Error ? e.name : e)
    return null
  } finally {
    clearTimeout(timer)
  }
}

const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => ((list as readonly unknown[]).includes(v) ? (v as T) : fallback)

/** Validates the model's JSON and enforces the rules the prompt asks for. Null if unusable. */
function shapeTurn(raw: unknown, lang: string, callerTurns: number) {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  let reply = clip(r.reply, MAX_REPLY_CHARS)
  let replyEn = clip(r.reply_en, MAX_REPLY_CHARS) ?? ''
  if (!reply) return null

  const emergency = r.emergency === true
  const d = r.draft && typeof r.draft === 'object' ? (r.draft as Record<string, unknown>) : null
  const draft: Draft | null =
    r.has_request === false || !d
      ? null
      : {
          category: oneOf(CATEGORY_IDS, d.category, 'other'),
          summary: fact(d.summary, 240),
          location: fact(d.location, 160),
          locationConfirmed: d.location_confirmed === true,
          details: fact(d.details, 240),
          urgency: emergency ? 'urgent' : oneOf(URGENCY, d.urgency, 'routine'),
          responsible: oneOf(RESPONSIBLE, d.responsible, 'unsure'),
        }

  // Status: the last turn always ends the call; "ready" needs a draft, otherwise it is "closed".
  let status = oneOf(['need_info', 'ready', 'closed'] as const, r.status, 'need_info')
  if (callerTurns >= MAX_CALLER_TURNS && status === 'need_info') status = draft ? 'ready' : 'closed'
  if (status === 'ready' && !draft) status = 'closed'
  if (status === 'closed' && draft?.summary && draft.location) status = 'ready'
  // A reply that ends with a question keeps the call open, whatever the model labelled it.
  if (status === 'closed' && callerTurns < MAX_CALLER_TURNS && /[?؟？]\s*$/.test(clip(r.reply, MAX_REPLY_CHARS) ?? '')) status = 'need_info'

  // Guards: wrong language or script, a claim of submission, or a question after the last turn.
  // Each falls back to a fixed line that is known to be correct.
  const script = LANGS[lang]?.script
  const wrongScript = script ? !script.test(reply) : false
  // Native words are checked on closing replies only: mid-call, "दर्ज" can appear in a question
  // ("would you like to register…?"), which claims nothing.
  const claims = (claimsInEnglish(replyEn) || (status !== 'need_info' && NATIVE_CLAIMS.test(reply))) && !emergency
  const asksAfterEnd = status !== 'need_info' && callerTurns >= MAX_CALLER_TURNS && /[?؟？]\s*$/.test(reply)
  if (wrongScript || claims || asksAfterEnd) {
    if (status === 'need_info' && draft && !draft.location && REPLY[lang]) {
      reply = REPLY[lang]
      replyEn = REPLY_GLOSS
    } else if (draft) {
      reply = DONE[lang] ?? DONE.eng
      replyEn = DONE_GLOSS
      status = 'ready'
    }
    // No draft (a general question or goodbye) and no fixed line that fits: keep the reply.
  }
  return { reply, replyEn, status, emergency, draft, guarded: wrongScript || claims || asksAfterEnd, wrongScript }
}

// ------------------------------------------------------------------ speech

// The same lines are spoken again and again during a demo; keep their audio per instance.
const audioCache = new Map<string, { audio: string; model: string }>()

interface Resolved extends Line {
  key: string
  /** Language codes in the line, used to pick the TTS model. */
  langs: string[]
  /** Language the line is spoken in ("mul" for two-language prompts). */
  lang: string
  parts?: Part[]
}

function resolveLine(body: unknown, env: Env): Resolved | null {
  if (!body || typeof body !== 'object') return null
  const b = body as { line?: unknown; lang?: unknown; pair?: unknown; text?: unknown; token?: unknown }
  const lang = typeof b.lang === 'string' ? b.lang : ''
  if (b.line === 'reply' || b.line === 'done') {
    const text = (b.line === 'reply' ? REPLY : DONE)[lang]
    if (!text) return null
    return { key: `${b.line}:${lang}`, text, gloss: b.line === 'reply' ? REPLY_GLOSS : DONE_GLOSS, langs: [lang], lang }
  }
  if (b.line === 'confirm') {
    const pair = typeof b.pair === 'string' ? b.pair : ''
    const line = CONFIRM[pair]
    if (!line) return null
    const langs = pair === 'generic' ? ['eng'] : pair.split('+')
    return { key: `confirm:${pair}`, ...line, langs, lang: langs.length > 1 ? 'mul' : langs[0] }
  }
  if (b.line === 'text') {
    const text = typeof b.text === 'string' ? b.text : ''
    if (!LANGS[lang] || !text || text.length > MAX_REPLY_CHARS || typeof b.token !== 'string' || !verify(env, lang, text, b.token)) return null
    return { key: `text:${lang}:${createHash('sha1').update(text).digest('hex')}`, text, gloss: '', langs: [lang], lang }
  }
  return null
}

async function handleSpeech(body: unknown, env: Env): Promise<Response> {
  const line = resolveLine(body, env)
  if (!line) return fail(400, 'unknown_line', 'The assistant has no such line.')
  const apiKey = env.ELEVENLABS_API_KEY as string

  const voice = env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE
  const standard = env.ELEVENLABS_TTS_MODEL || DEFAULT_TTS_MODEL
  const extended = env.ELEVENLABS_TTS_MODEL_EXTENDED || DEFAULT_TTS_MODEL_EXTENDED
  const models = line.langs.some((l) => EXTENDED_LANGS.has(l)) ? [extended, standard] : [standard]

  const cacheKey = `${voice}|${models[0]}|${line.key}`
  const reply = (audio: string | null, model: string | null, audioError: string | null) =>
    json(200, { text: line.text, parts: line.parts ?? [{ text: line.text, lang: line.lang }], gloss: line.gloss, lang: line.lang, audio, model, audioError })
  const cached = audioCache.get(cacheKey)
  if (cached) return reply(cached.audio, cached.model, null)

  const base = (env.ELEVENLABS_API_BASE || 'https://api.elevenlabs.io').replace(/\/$/, '')
  let audioError = 'Voice reply unavailable.'
  // If the extended model is refused (plan, region or language), fall back to the standard one.
  for (const model of models) {
    const result = await synthesize(base, apiKey, voice, model, line.text)
    if ('audio' in result) {
      if (audioCache.size >= CACHE_MAX) audioCache.delete(audioCache.keys().next().value as string)
      audioCache.set(cacheKey, { audio: result.audio, model })
      return reply(result.audio, model, null)
    }
    audioError = result.error
    if (!result.tryNext) break
  }
  // Speech failed, but the words still matter: return them so the conversation can go on.
  return reply(null, null, audioError)
}

async function synthesize(
  base: string,
  apiKey: string,
  voice: string,
  model: string,
  text: string,
): Promise<{ audio: string } | { error: string; tryNext: boolean }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS)
  try {
    const res = await fetch(`${base}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model }),
      signal: controller.signal,
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        // ElevenLabs keys can be scoped; a speech-to-text-only key is a common setup mistake.
        const detail = (await res.json().catch(() => null)) as { detail?: { status?: string } } | null
        return detail?.detail?.status === 'missing_permissions'
          ? { error: 'Voice replies are off: the ElevenLabs API key lacks the Text to Speech permission.', tryNext: false }
          : { error: 'The server’s ElevenLabs credentials were rejected.', tryNext: false }
      }
      if (res.status === 404) return { error: 'Voice not found. Set ELEVENLABS_VOICE_ID to a voice in your ElevenLabs library.', tryNext: false }
      if (res.status === 429) return { error: 'The voice service is busy. The reply is shown as text.', tryNext: false }
      return { error: `The voice service returned an error (${res.status}).`, tryNext: res.status === 400 || res.status === 422 }
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 512) return { error: 'The voice service returned empty audio.', tryNext: true }
    return { audio: buf.toString('base64') }
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return { error: aborted ? 'The voice reply took too long.' : 'Could not reach the voice service.', tryNext: false }
  } finally {
    clearTimeout(timer)
  }
}

// Vercel entry points (Web-standard handlers).
export function GET(): Response {
  return handleAssistantStatus()
}

export function POST(request: Request): Promise<Response> {
  return handleAssistant(request)
}

"""Live 311 voice demo — the part the frontend (Streamlit) calls.

    from src.live_demo import handle_request
    result = handle_request(audio_bytes, "recording.wav")

Pipeline: speech -> ElevenLabs Scribe -> language check -> request category
          -> reply text in the caller's language -> ElevenLabs TTS audio.

PROTOTYPE ONLY: keyword categories and template replies, no real 311 submission.
Translations were machine-written: have a native speaker check them before the demo.
"""
from __future__ import annotations

import os

from .elevenlabs_client import text_to_speech, transcribe_bytes

CONFIDENCE_THRESHOLD = 0.80

LANGUAGE_NAMES = {
    "eng": "English", "urd": "Urdu", "ara": "Arabic", "zho": "Chinese", "cmn": "Mandarin Chinese",
    "yue": "Cantonese", "pan": "Punjabi", "pol": "Polish", "fil": "Tagalog", "tgl": "Tagalog",
    "spa": "Spanish", "tam": "Tamil", "vie": "Vietnamese", "hin": "Hindi", "por": "Portuguese",
    "guj": "Gujarati", "ben": "Bengali",
}

# Pairs our FLEURS tests showed (or that are known) to get confused
CONFUSABLE = {"urd": "hin", "hin": "urd", "pan": "urd", "zho": "yue", "cmn": "yue", "yue": "zho"}

# "Do you speak X or Y?" — asked in both languages when detection is uncertain
CONFIRM_PROMPTS = {
    frozenset({"urd", "hin"}): "کیا آپ اردو بولتے ہیں؟ क्या आप हिंदी बोलते हैं?",
    frozenset({"pan", "urd"}): "ਕੀ ਤੁਸੀਂ ਪੰਜਾਬੀ ਬੋਲਦੇ ਹੋ? کیا آپ اردو بولتے ہیں؟",
    frozenset({"zho", "yue"}): "請問你講廣東話定普通話？请问您说普通话还是粤语？",
    frozenset({"cmn", "yue"}): "請問你講廣東話定普通話？请问您说普通话还是粤语？",
}

CATEGORIES = {
    "Streetlight": ["streetlight", "street light", "light is out", "lamp", "بتی", "روشنی", "बत्ती", "लाइट",
                    "ਬੱਤੀ", "إنارة", "مصباح", "路灯", "路燈", "farola", "ilaw", "latarnia", "poste", "đèn", "விளக்கு"],
    "Pothole / Road": ["pothole", "road", "sidewalk", "گڑھا", "سڑک", "गड्ढा", "सड़क", "ਟੋਆ", "ਸੜਕ", "حفرة",
                       "طريق", "坑", "马路", "馬路", "bache", "calle", "lubak", "dziura", "buraco", "ổ gà", "குழி"],
    "Garbage / Recycling": ["garbage", "trash", "recycling", "waste", "کچرا", "کوڑا", "कचरा", "कूड़ा", "ਕੂੜਾ",
                            "قمامة", "垃圾", "basura", "śmieci", "lixo", "rác", "குப்பை"],
    "Noise": ["noise", "loud", "شور", "शोर", "ਸ਼ੋਰ", "ضوضاء", "噪音", "嘈", "ruido", "ingay", "hałas",
              "barulho", "ồn", "சத்தம்"],
    "Water / Flooding": ["water", "flood", "leak", "پانی", "पानी", "ਪਾਣੀ", "ماء", "مياه", "水", "agua",
                         "tubig", "woda", "água", "nước", "தண்ணீர்"],
}

# "Thank you, I understood your request. Please tell me the address."
REPLIES = {
    "eng": "Thank you, I understood your request. Please tell me the address.",
    "urd": "شکریہ، میں آپ کی درخواست سمجھ گیا ہوں۔ براہ کرم مجھے پتہ بتائیں۔",
    "hin": "धन्यवाद, मैंने आपका अनुरोध समझ लिया है। कृपया मुझे पता बताइए।",
    "pan": "ਧੰਨਵਾਦ, ਮੈਂ ਤੁਹਾਡੀ ਬੇਨਤੀ ਸਮਝ ਗਿਆ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਮੈਨੂੰ ਪਤਾ ਦੱਸੋ।",
    "ara": "شكرًا، لقد فهمت طلبك. من فضلك أخبرني بالعنوان.",
    "zho": "谢谢，我已经了解您的请求。请告诉我地址。",
    "cmn": "谢谢，我已经了解您的请求。请告诉我地址。",
    "yue": "多謝，我明白你嘅要求。請話我知地址。",
    "fil": "Salamat, naintindihan ko ang iyong kahilingan. Pakisabi po ang address.",
    "tgl": "Salamat, naintindihan ko ang iyong kahilingan. Pakisabi po ang address.",
    "spa": "Gracias, entendí su solicitud. Por favor, dígame la dirección.",
    "pol": "Dziękuję, zrozumiałem Pana/Pani zgłoszenie. Proszę podać adres.",
    "por": "Obrigado, percebi o seu pedido. Por favor, diga-me a morada.",
    "vie": "Cảm ơn, tôi đã hiểu yêu cầu của bạn. Vui lòng cho tôi biết địa chỉ.",
    "tam": "நன்றி, உங்கள் கோரிக்கையை புரிந்துகொண்டேன். தயவுசெய்து முகவரியைச் சொல்லுங்கள்.",
    "guj": "આભાર, હું તમારી વિનંતી સમજી ગયો છું. કૃપા કરીને મને સરનામું જણાવો.",
    "ben": "ধন্যবাদ, আমি আপনার অনুরোধ বুঝেছি। অনুগ্রহ করে আমাকে ঠিকানাটি বলুন।",
}


def classify_request(text: str | None) -> str:
    if not text:
        return "Unknown"
    t = text.lower()
    for cat, words in CATEGORIES.items():
        if any(w in t for w in words):
            return cat
    return "Other / General inquiry"


def handle_request(audio_bytes: bytes, filename: str = "recording.wav",
                   language_hint: str | None = None, speak: bool = True) -> dict:
    """Main entry point for the frontend.

    language_hint: 3-letter code if the caller chose a language (e.g. "urd"); None = auto-detect.
    Returns a dict:
      transcript, detected_language, language_name, confidence,
      needs_confirmation, confirmation_prompt, category,
      reply_text, reply_audio (MP3 bytes or None), error
    """
    stt = transcribe_bytes(audio_bytes, filename, language_code=language_hint)
    out = {
        "transcript": stt["text"], "detected_language": stt["detected_language"],
        "language_name": LANGUAGE_NAMES.get(stt["detected_language"] or "", stt["detected_language"]),
        "confidence": stt["language_probability"], "needs_confirmation": False,
        "confirmation_prompt": None, "category": None, "reply_text": None,
        "reply_audio": None, "error": stt["error"],
    }
    if stt["error"]:
        return out

    lang = stt["detected_language"] or "eng"
    conf = stt["language_probability"] or 0.0
    if not language_hint and (conf < CONFIDENCE_THRESHOLD or lang in CONFUSABLE):
        other = CONFUSABLE.get(lang)
        prompt = CONFIRM_PROMPTS.get(frozenset({lang, other})) if other else None
        # Only interrupt the caller when detection is actually uncertain
        if conf < CONFIDENCE_THRESHOLD:
            out["needs_confirmation"] = True
            out["confirmation_prompt"] = prompt or "Which language do you speak?"

    out["category"] = classify_request(stt["text"])
    out["reply_text"] = out["confirmation_prompt"] if out["needs_confirmation"] else REPLIES.get(lang, REPLIES["eng"])

    if speak:
        try:
            out["reply_audio"] = text_to_speech(out["reply_text"],
                                                model_id=os.getenv("ELEVENLABS_TTS_MODEL", "eleven_multilingual_v2"))
        except Exception as e:  # demo must not crash if TTS fails
            out["error"] = f"TTS failed: {e}"
    return out

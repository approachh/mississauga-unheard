"""Text normalization + language/script checks.

The FLEURS `transcription` column is already lower-case without punctuation,
so the prediction must be normalized the SAME way before computing WER/CER.
"""
from __future__ import annotations

import re
import unicodedata

# Languages without spaces between words: report CER only
NO_WORD_BOUNDARY = {"zh", "yue"}

# Scribe returns 3-letter codes; we accept several aliases per language.
# Verify against the ElevenLabs supported-languages list if something looks off.
ISO3_ALIASES = {
    "en": {"en", "eng"},
    "ur": {"ur", "urd"},
    "ar": {"ar", "ara", "arb", "arz"},
    "zh": {"zh", "zho", "cmn", "chi"},
    "yue": {"yue"},
    "pa": {"pa", "pan"},
    "pl": {"pl", "pol"},
    "tl": {"tl", "tgl", "fil"},
    "es": {"es", "spa"},
    "ta": {"ta", "tam"},
    "vi": {"vi", "vie"},
    "hi": {"hi", "hin"},
    "pt": {"pt", "por"},
    "gu": {"gu", "guj"},
    "bn": {"bn", "ben"},
}

# Code sent to Scribe in "forced" mode
FORCED_CODE = {
    "en": "eng", "ur": "urd", "ar": "ara", "zh": "cmn", "yue": "yue", "pa": "pan",
    "pl": "pol", "tl": "fil", "es": "spa", "ta": "tam", "vi": "vie", "hi": "hin",
    "pt": "por", "gu": "guj", "bn": "ben",
}

# Expected writing system per language (Unicode script, by character name prefix)
EXPECTED_SCRIPT = {
    "ur": "ARABIC", "ar": "ARABIC", "pa": "GURMUKHI", "hi": "DEVANAGARI",
    "ta": "TAMIL", "gu": "GUJARATI", "bn": "BENGALI", "zh": "CJK", "yue": "CJK",
    "en": "LATIN", "pl": "LATIN", "tl": "LATIN", "es": "LATIN", "vi": "LATIN", "pt": "LATIN",
}

# Small marker sets for Simplified vs Traditional Chinese (common characters only)
SIMPLIFIED_ONLY = set("这们说时国会来为个对们发经过还后们见开关问长东车门马鸟书学习话语请让认识视觉")
TRADITIONAL_ONLY = set("這們說時國會來為個對發經過還後見開關問長東車門馬鳥書學習話語請讓認識視覺")


def normalize(text: str | None, lang: str) -> str:
    """NFC, lowercase, remove punctuation/symbols (all scripts), collapse spaces."""
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text).lower()
    text = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", text)  # drop tags like (laughter) [music]
    out = []
    for ch in text:
        cat = unicodedata.category(ch)
        if cat.startswith("P") or cat.startswith("S"):
            out.append(" ")
        elif cat.startswith("M") or cat.startswith("L") or cat.startswith("N") or ch.isspace():
            out.append(ch)
        else:
            out.append(" ")
    text = re.sub(r"\s+", " ", "".join(out)).strip()
    if lang in NO_WORD_BOUNDARY:
        text = text.replace(" ", "")
    return text


def dominant_script(text: str | None) -> str | None:
    """Most common Unicode script among letters in the text."""
    if not text:
        return None
    counts: dict[str, int] = {}
    for ch in text:
        if not unicodedata.category(ch).startswith("L"):
            continue
        try:
            name = unicodedata.name(ch)
        except ValueError:
            continue
        script = "CJK" if name.startswith("CJK") else name.split(" ")[0]
        counts[script] = counts.get(script, 0) + 1
    return max(counts, key=counts.get) if counts else None


def chinese_variant(text: str | None) -> str | None:
    if not text:
        return None
    s = sum(ch in SIMPLIFIED_ONLY for ch in text)
    t = sum(ch in TRADITIONAL_ONLY for ch in text)
    if s == t == 0:
        return None
    return "simplified" if s > t else "traditional"


def language_mismatch(expected_iso: str, detected: str | None) -> bool | None:
    if not detected:
        return None
    return detected.lower() not in ISO3_ALIASES.get(expected_iso, {expected_iso})


def script_mismatch(expected_iso: str, prediction: str | None) -> bool | None:
    """True for e.g. Urdu written in Devanagari (= transcribed as Hindi),
    or Cantonese written in Simplified characters (FLEURS Cantonese is Traditional)."""
    script = dominant_script(prediction)
    if script is None:
        return None
    if script != EXPECTED_SCRIPT.get(expected_iso, script):
        return True
    if expected_iso == "yue":
        return chinese_variant(prediction) == "simplified"
    return False

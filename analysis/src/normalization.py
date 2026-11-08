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
    "en": "eng", "ur": "urd", "ar": "ara", "zh": "zho", "yue": "yue", "pa": "pan",
    "pl": "pol", "tl": "fil", "es": "spa", "ta": "tam", "vi": "vie", "hi": "hin",
    "pt": "por", "gu": "guj", "bn": "ben",
}

# Expected writing system per language (Unicode script, by character name prefix)
EXPECTED_SCRIPT = {
    "ur": "ARABIC", "ar": "ARABIC", "pa": "GURMUKHI", "hi": "DEVANAGARI",
    "ta": "TAMIL", "gu": "GUJARATI", "bn": "BENGALI", "zh": "CJK", "yue": "CJK",
    "en": "LATIN", "pl": "LATIN", "tl": "LATIN", "es": "LATIN", "vi": "LATIN", "pt": "LATIN",
}

# Simplified <-> Traditional Chinese. Uses OpenCC when installed
# (pip install opencc-python-reimplemented), otherwise a fallback marker list.
try:
    from opencc import OpenCC
    _T2S, _S2T = OpenCC("t2s"), OpenCC("s2t")
except Exception:  # not installed
    _T2S = _S2T = None

# Fallback pairs (simplified, traditional) for common characters
_PAIRS = ("这這 们們 说說 时時 国國 会會 来來 为為 个個 对對 发發 经經 过過 还還 后後 见見 开開 关關 "
          "问問 长長 东東 车車 门門 马馬 鸟鳥 书書 学學 习習 话話 语語 请請 让讓 认認 识識 视視 觉覺 "
          "装裝 镇鎮 进進 泪淚 伤傷 员員 医醫 将將 讯訊 号號 卫衛 节節 庆慶 区區 闭閉 约約 归歸 处處 "
          "现現 动動 实實 战戰 虽雖 样樣 级級 课課 机機 报報 务務 难難 业業 华華 网網 应應 电電 场場 "
          "备備 冲衝 击擊 无無 边邊 两兩 继繼 续續 剧劇 气氣 灵靈 罗羅 历歷 乐樂 戏戲 线線 营營 览覽").split()
_S2T_MAP = {p[0]: p[1] for p in _PAIRS}
SIMPLIFIED_ONLY = set(_S2T_MAP)
TRADITIONAL_ONLY = set(_S2T_MAP.values())


def to_simplified(text: str | None) -> str:
    """Script-neutral form for Chinese CER (so 們 vs 们 is not counted as an error)."""
    if not text:
        return ""
    if _T2S:
        return _T2S.convert(text)
    return text.translate({ord(t): s for s, t in _S2T_MAP.items()})


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
    """'simplified', 'traditional' or None (can't tell / no Chinese)."""
    if not text:
        return None
    if _T2S:
        n_simp = sum(a != b for a, b in zip(text, _S2T.convert(text)))  # chars that change -> simplified
        n_trad = sum(a != b for a, b in zip(text, _T2S.convert(text)))  # chars that change -> traditional
    else:
        n_simp = sum(ch in SIMPLIFIED_ONLY for ch in text)
        n_trad = sum(ch in TRADITIONAL_ONLY for ch in text)
    if n_simp == n_trad == 0:
        return None
    return "simplified" if n_simp > n_trad else "traditional"


def latin_word_share(prediction: str | None, expected_iso: str) -> float | None:
    """Share of words written in Latin letters inside a non-Latin language
    (code-switching like 'gap', 'course', 'family' in Hindi/Urdu output)."""
    if EXPECTED_SCRIPT.get(expected_iso) == "LATIN" or not prediction:
        return None
    words = re.findall(r"\w+", prediction)
    if not words:
        return None
    latin = sum(all("a" <= c.lower() <= "z" for c in w) for w in words)
    return latin / len(words)


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

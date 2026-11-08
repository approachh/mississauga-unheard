"""Thin wrapper around the ElevenLabs Speech-to-Text (Scribe) REST API.

Uses plain `requests` so we don't depend on SDK version differences.
Docs: https://elevenlabs.io/docs (Speech-to-Text)
"""
from __future__ import annotations

import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv()

STT_URL = "https://api.elevenlabs.io/v1/speech-to-text"
TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

MODEL_ID = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v2")

MIME = {".flac": "audio/flac", ".mp3": "audio/mpeg", ".wav": "audio/wav",
        ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".webm": "audio/webm"}


def _api_key() -> str:
    key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not key or key == "your_key_here":
        raise RuntimeError("ELEVENLABS_API_KEY is missing. Put it in analysis/.env")
    return key


def transcribe_bytes(audio: bytes, filename: str, language_code: str | None = None,
                     max_retries: int = 4, timeout: int = 120) -> dict:
    """Send audio to Scribe. language_code=None -> automatic language detection.

    Returns: {text, detected_language, language_probability, error}
    """
    data = {"model_id": MODEL_ID, "tag_audio_events": "false"}  # no "(laughter)" tags: they inflate WER
    if language_code:
        data["language_code"] = language_code

    mime = MIME.get(Path(filename).suffix.lower(), "application/octet-stream")
    last_err = None
    for attempt in range(max_retries):
        try:
            r = requests.post(
                STT_URL,
                headers={"xi-api-key": _api_key()},
                data=data,
                files={"file": (Path(filename).name, audio, mime)},
                timeout=timeout,
            )
            if r.status_code == 200:
                j = r.json()
                return {
                    "text": j.get("text", ""),
                    "detected_language": j.get("language_code"),
                    "language_probability": j.get("language_probability"),
                    "error": None,
                }
            # Retry only on rate limits and server errors
            if r.status_code == 429 or r.status_code >= 500:
                last_err = f"HTTP {r.status_code}: {r.text[:200]}"
                time.sleep(2 ** attempt * 2)
                continue
            return {"text": None, "detected_language": None, "language_probability": None,
                    "error": f"HTTP {r.status_code}: {r.text[:300]}"}
        except requests.RequestException as e:
            last_err = str(e)
            time.sleep(2 ** attempt * 2)
    return {"text": None, "detected_language": None, "language_probability": None,
            "error": f"failed after {max_retries} retries: {last_err}"}


def transcribe_file(path: str | Path, language_code: str | None = None) -> dict:
    path = Path(path)
    return transcribe_bytes(path.read_bytes(), path.name, language_code)


def text_to_speech(text: str, voice_id: str | None = None,
                   model_id: str = "eleven_multilingual_v2") -> bytes:
    """Returns MP3 bytes. Used by the live demo."""
    voice_id = voice_id or os.getenv("ELEVENLABS_VOICE_ID", "")
    if not voice_id:
        raise RuntimeError("Set ELEVENLABS_VOICE_ID in .env (copy a voice ID from the ElevenLabs Voices page)")
    r = requests.post(
        TTS_URL.format(voice_id=voice_id),
        headers={"xi-api-key": _api_key(), "Content-Type": "application/json"},
        json={"text": text, "model_id": model_id},
        timeout=60,
    )
    r.raise_for_status()
    return r.content

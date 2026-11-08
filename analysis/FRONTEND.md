# For the frontend (Member 4)

## 1. Data files (`analysis/outputs/`)

| File | One row per | Use it for |
|---|---|---|
| `speech_summary.csv` | dataset × mode × language | Main chart: error by language (`mean_cer_script_neutral`, CI in `cer_ci_low/high`) |
| `speech_results.csv` | clip | Filters, scatter plots, Member 3's index |
| `showcase_examples.csv` | hand-picked clip | "What the AI heard" cards with audio |

Language names match `language_crosswalk.csv` (join key: `language`).

Chart tips: plot `mean_cer_script_neutral` (fair across scripts); show `n_clips` and `genders`
next to each bar — samples are small and some languages are single-gender.

## 2. Showcase card (Streamlit)

```python
import pandas as pd, streamlit as st
from pathlib import Path

OUT = Path("analysis/outputs")
ex = pd.read_csv(OUT / "showcase_examples.csv", encoding="utf-8-sig")
for _, r in ex.iterrows():
    with st.container(border=True):
        st.markdown(f"**{r.language}** — {r.why}")
        st.audio(str(OUT / r.audio))
        c1, c2 = st.columns(2)
        c1.caption("What they said");  c1.write(r.reference)
        c2.caption(f"What the AI heard ({r.detected_language})");  c2.write(r.prediction)
        st.caption(f"Character error rate: {r.cer_script_neutral:.0%}")
```

## 3. Live 311 demo

```python
import sys, streamlit as st
sys.path.append("analysis")
from src.live_demo import handle_request

audio = st.audio_input("Tell us what you need") or st.file_uploader("…or upload audio")
lang = st.selectbox("Language (optional)", ["Auto-detect", "urd", "pan", "hin", "ara", "zho", "yue",
                                            "fil", "spa", "pol", "por", "tam", "vie", "guj", "eng"])
if audio:
    with st.spinner("Listening…"):
        res = handle_request(audio.getvalue(), getattr(audio, "name", "recording.wav"),
                             language_hint=None if lang == "Auto-detect" else lang)
    if res["error"] and not res["transcript"]:
        st.error(res["error"])
    else:
        st.write("**Heard:**", res["transcript"])
        st.write(f"**Language:** {res['language_name']} ({(res['confidence'] or 0):.0%} sure)")
        if res["needs_confirmation"]:
            st.warning("Not sure about the language, so the assistant asks first.")
        st.write("**Category:**", res["category"])
        st.write("**Reply:**", res["reply_text"])
        if res["reply_audio"]:
            st.audio(res["reply_audio"], format="audio/mp3", autoplay=True)
```

`handle_request` returns: `transcript, detected_language, language_name, confidence,
needs_confirmation, confirmation_prompt, category, reply_text, reply_audio (MP3 bytes), error`.

Needs in `analysis/.env`: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (for the spoken reply).
Run Streamlit from the repo root so the `analysis/...` paths resolve.

import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { CommunityIntelligence } from './pages/CommunityIntelligence'
import { ComingSoon } from './pages/ComingSoon'
import { Overview } from './pages/Overview'
import { SpeechIntelligence } from './pages/SpeechIntelligence'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Overview />} />
          <Route path="speech" element={<SpeechIntelligence />} />
          <Route path="community" element={<CommunityIntelligence />} />
          <Route
            path="voice"
            element={
              <ComingSoon
                title="Hear yourself through AI"
                lede="Speak in your language and see exactly what ElevenLabs Scribe recognised, compared word by word with what you meant to say."
                planned={[
                  'Choose your language',
                  'Record from the microphone or upload an audio file',
                  'See the AI transcript marked against the text you intended',
                ]}
                note="Transcription will run through a secure server-side proxy. API keys never reach the browser."
              />
            }
          />
          <Route
            path="*"
            element={
              <div className="py-20">
                <h1 className="text-[2.75rem] font-semibold tracking-[-0.03em]">Not heard.</h1>
                <p className="mt-2 text-ink-2">This page doesn’t exist.</p>
                <Link to="/" className="mt-6 inline-block font-medium underline">
                  Back to overview
                </Link>
              </div>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

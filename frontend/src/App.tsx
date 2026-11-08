import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { CommunityIntelligence } from './pages/CommunityIntelligence'
import { VoiceExperience } from './pages/VoiceExperience'
import { Overview } from './pages/Overview'
import { SpeechIntelligence } from './pages/SpeechIntelligence'

function ScrollToTop() {
  const { pathname } = useLocation()
  // Block body on purpose: newer browsers return a Promise from scrollTo, and an effect that
  // returns a non-function makes React crash when it later tries to call it as a cleanup.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
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
          <Route path="voice" element={<VoiceExperience />} />
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

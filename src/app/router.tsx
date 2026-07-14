import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoadingTuner } from '../components/feedback/LoadingTuner'
import { AppLayout } from '../layouts/AppLayout'
import { GiftLoaderPage } from '../pages/GiftLoaderPage'

const WelcomePage = lazy(() => import('../pages/WelcomePage'))
const MoodPage = lazy(() => import('../pages/MoodPage'))
const RadioPage = lazy(() => import('../pages/RadioPage'))
const LibraryPage = lazy(() => import('../pages/LibraryPage'))
const SettingsPage = lazy(() => import('../pages/SettingsPage'))
const AboutPage = lazy(() => import('../pages/AboutPage'))
const PlaybackTestPage = lazy(() => import('../pages/PlaybackTestPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))

const PageFallback = () => <LoadingTuner heading="Changing frequency" message="One clear signal, coming up…" />

export function AppRouter() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/g/siti" replace />} />
        <Route path="/g/:giftSlug" element={<GiftLoaderPage />}>
          <Route element={<AppLayout />}>
            <Route index element={<WelcomePage />} />
            <Route path="mood" element={<MoodPage />} />
            <Route path="radio" element={<RadioPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="playback-test" element={<PlaybackTestPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

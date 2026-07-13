import { lazy, Suspense, useState } from 'react'
import { Bot, Info } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useExperience } from '../app/providers'
import { StationLogo } from '../components/common/StationLogo'
import { BottomNav } from '../components/navigation/BottomNav'

const WisseBotDialog = lazy(() =>
  import('../features/bot/WisseBotDialog').then((module) => ({ default: module.WisseBotDialog })),
)

export function AppLayout() {
  const { slug, profile } = useExperience()
  const location = useLocation()
  const [botOpen, setBotOpen] = useState(false)
  const isWelcome = location.pathname === `/g/${slug}` || location.pathname === `/g/${slug}/`

  return (
    <div className={`app-shell${isWelcome ? ' app-shell--welcome' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {!isWelcome && (
        <header className="topbar">
          <Link className="topbar__brand" to={`/g/${slug}`} aria-label={`${profile.gift.station.name} home`}>
            <StationLogo name={profile.gift.station.shortName} compact />
          </Link>
          <div className="topbar__actions">
            {profile.gift.features.wisseBot && (
              <button className="icon-button" type="button" onClick={() => setBotOpen(true)} aria-label={`Open ${profile.gift.assistant.name}`}>
                <Bot size={20} aria-hidden="true" />
              </button>
            )}
            <Link className="icon-button" to={`/g/${slug}/about`} aria-label="About Pink FM">
              <Info size={20} aria-hidden="true" />
            </Link>
          </div>
        </header>
      )}
      <Outlet context={{ openBot: () => setBotOpen(true) }} />
      {!isWelcome && <BottomNav slug={slug} />}
      {profile.gift.features.wisseBot && botOpen && (
        <Suspense fallback={null}>
          <WisseBotDialog open={botOpen} onClose={() => setBotOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}

export type LayoutOutletContext = { openBot: () => void }

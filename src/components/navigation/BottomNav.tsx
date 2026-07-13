import { Heart, Radio, Settings, SlidersHorizontal } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { path: 'mood', label: 'Mood', Icon: SlidersHorizontal },
  { path: 'radio', label: 'Radio', Icon: Radio },
  { path: 'library', label: 'Library', Icon: Heart },
  { path: 'settings', label: 'Settings', Icon: Settings },
]

export function BottomNav({ slug }: { slug: string }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {items.map(({ path, label, Icon }) => (
        <NavLink
          key={path}
          className="bottom-nav__item"
          to={`/g/${slug}/${path}`}
          aria-label={label}
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

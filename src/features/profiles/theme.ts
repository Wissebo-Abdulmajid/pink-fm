import type { GiftConfig } from '../../config/schemas'

const themeVariableNames: Record<keyof GiftConfig['theme'], string> = {
  background: '--color-background',
  surface: '--color-surface',
  surfaceAlt: '--color-surface-alt',
  primary: '--color-primary',
  primaryStrong: '--color-primary-strong',
  secondary: '--color-secondary',
  accent: '--color-accent',
  text: '--color-text',
  mutedText: '--color-muted-text',
  plum: '--color-plum',
  speakerCloth: '--color-speaker-cloth',
}

export const applyProfileTheme = (gift: GiftConfig) => {
  const root = document.documentElement
  Object.entries(gift.theme).forEach(([key, value]) => {
    root.style.setProperty(themeVariableNames[key as keyof GiftConfig['theme']], value)
  })
  root.lang = gift.locale
  document.title = `${gift.station.name} — ${gift.station.tagline}`
  const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  metaTheme?.setAttribute('content', gift.theme.primary)
}

export const clearProfileTheme = () => {
  const root = document.documentElement
  Object.values(themeVariableNames).forEach((name) => root.style.removeProperty(name))
  root.classList.remove('high-contrast', 'reduce-motion')
}

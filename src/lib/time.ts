import type { RecommendationContext } from '../features/recommendations/engine'

export const getTimeOfDay = (date = new Date()): NonNullable<RecommendationContext['timeOfDay']> => {
  const hour = date.getHours()
  if (hour < 11) return 'morning'
  if (hour < 17) return 'daytime'
  if (hour < 21) return 'evening'
  return 'night'
}

export const formatHistoryTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp)

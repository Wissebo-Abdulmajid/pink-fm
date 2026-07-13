import { cn } from '../../lib/utils'

const ticks = ['88', '90', '92', '94', '96', '98', '100', '102', '104', '106']

export function FrequencyScale({
  value = 47,
  label,
  compact = false,
}: {
  value?: number
  label: string
  compact?: boolean
}) {
  return (
    <div className={cn('frequency-scale', compact && 'frequency-scale--compact')} aria-label={label} role="img">
      <div className="frequency-scale__numbers" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <div className="frequency-scale__rail" aria-hidden="true">
        <span className="frequency-scale__needle" style={{ left: `${Math.min(96, Math.max(4, value))}%` }} />
      </div>
      <span className="frequency-scale__band" aria-hidden="true">FM · MHz</span>
    </div>
  )
}

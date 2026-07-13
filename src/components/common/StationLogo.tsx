import { Radio } from 'lucide-react'
import { cn } from '../../lib/utils'

export function StationLogo({
  name,
  compact = false,
  className,
}: {
  name: string
  compact?: boolean
  className?: string
}) {
  return (
    <span className={cn('station-logo', compact && 'station-logo--compact', className)}>
      <span className="station-logo__mark" aria-hidden="true">
        <Radio size={compact ? 18 : 25} strokeWidth={2.1} />
      </span>
      <span className="station-logo__type">{name}</span>
    </span>
  )
}

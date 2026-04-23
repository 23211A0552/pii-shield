import clsx from 'clsx'

const LEVELS = {
  CRITICAL: { label: 'Critical', cls: 'risk-badge-critical' },
  HIGH:     { label: 'High',     cls: 'risk-badge-high'     },
  MEDIUM:   { label: 'Medium',   cls: 'risk-badge-medium'   },
  LOW:      { label: 'Low',      cls: 'risk-badge-low'      },
  SAFE:     { label: 'Safe',     cls: 'risk-badge-safe'     },
  UNKNOWN:  { label: 'Unknown',  cls: 'glass text-white/40 border border-white/10 px-2 py-0.5 rounded text-xs font-medium' },
}

// Dot colour per level (used for the small indicator dot)
const DOT_COLOR = {
  CRITICAL: 'bg-red-700',
  HIGH:     'bg-red-500',
  MEDIUM:   'bg-yellow-500',
  LOW:      'bg-green-500',
  SAFE:     'bg-blue-500',
  UNKNOWN:  'bg-white/20',
}

export default function RiskBadge({ level, size = 'sm', showDot = false, className }) {
  const key = level?.toUpperCase() || 'UNKNOWN'
  const cfg = LEVELS[key] || LEVELS.UNKNOWN
  const dot = DOT_COLOR[key] || DOT_COLOR.UNKNOWN

  return (
    <span className={clsx(
      cfg.cls,
      'inline-flex items-center gap-1.5',
      size === 'lg' && 'text-sm px-3 py-1',
      className,
    )}>
      {showDot && <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dot)} />}
      {cfg.label}
    </span>
  )
}
import clsx from 'clsx'

const getLevel = (score) => {
  if (score >= 70) return { label: 'Critical', color: '#b91c1c' }
  if (score >= 40) return { label: 'High',     color: '#ef4444' }
  if (score >= 20) return { label: 'Medium',   color: '#f59e0b' }
  return               { label: 'Low',      color: '#10b981' }
}

export default function RiskScore({ score, showLabel = false, className }) {
  if (score === undefined || score === null) return null

  const pct   = Math.min(100, Math.max(0, score))
  const { label, color } = getLevel(pct)

  return (
    <div className={clsx('space-y-1', className)}>
      <div className="flex justify-between items-center">
        <span className="text-xs text-white/50">Risk Score</span>
        <div className="flex items-center gap-2">
          {showLabel && (
            <span className="text-xs text-white/40">{label}</span>
          )}
          <span className="text-sm font-display font-bold" style={{ color }}>{pct}</span>
        </div>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}
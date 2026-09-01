import { cn } from "@/lib/utils"
import { INDUSTRY_META } from "@/lib/careers/industries"
import {
  CAREER_LEVEL_LABELS,
  type CareerLevel,
  type Industry,
  type ReadinessBar,
} from "@/lib/careers/types"

export function LevelBadge({ level, className }: { level: CareerLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {CAREER_LEVEL_LABELS[level]}
    </span>
  )
}

/**
 * Industry tag. The colour dot is decorative only — the label is always
 * rendered beside it, because the --chart-* tokens collapse to greyscale in
 * dark mode and colour alone would carry no meaning.
 */
export function IndustryTag({
  industry,
  className,
}: {
  industry: Industry
  className?: string
}) {
  const meta = INDUSTRY_META[industry]
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground", className)}
    >
      <span className={cn("size-2 shrink-0 rounded-full", meta.accent.dot)} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-baseline gap-0.5 rounded-lg bg-primary/10 px-2.5 py-1 font-serif text-lg font-semibold text-primary",
        className,
      )}
    >
      {score}
      <span className="font-sans text-xs font-medium">%</span>
    </span>
  )
}

/** Horizontal meter. Uses role="img" so the value is announced once, cleanly. */
export function Meter({
  value,
  label,
  className,
}: {
  value: number
  label: string
  className?: string
}) {
  const safe = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-secondary", className)}
      role="img"
      aria-label={`${label}: ${safe} percent`}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${safe}%` }} />
    </div>
  )
}

export function ReadinessBars({ bars }: { bars: ReadinessBar[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {bars.map((bar) => (
        <li key={bar.label}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium">{bar.label}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{bar.value}%</span>
          </div>
          <Meter className="mt-1.5" value={bar.value} label={bar.label} />
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{bar.hint}</p>
        </li>
      ))}
    </ul>
  )
}

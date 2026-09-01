"use client"

// Form and readout primitives shared by every calculator on the site
// (solar and landscaping) so all tools stay visually consistent.

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  ariaLabel: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-primary bg-primary/15 font-medium text-foreground"
                : "border-input bg-background text-muted-foreground hover:border-ring hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function Stat({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string
  value: string
  sub?: string
  emphasis?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-serif tabular-nums leading-none",
          emphasis ? "text-3xl font-semibold text-foreground" : "text-2xl",
        )}
      >
        {value}
      </span>
      {sub ? <span className="text-xs leading-relaxed text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

export function Panel({
  title,
  icon,
  children,
  className,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
        {icon}
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import {
  Check,
  DoorOpen,
  Eye,
  Home,
  Info,
  Plus,
  RotateCcw,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  computePlan,
  GROUP_LABELS,
  GROUP_ORDER,
  money,
  moneyRange,
  RECOMMENDED_ORDER,
  TIER_COLORS,
  TIER_LABELS,
  UPGRADE_BY_ID,
  UPGRADES,
  type PriorityTier,
  type UpgradeGroup,
  type UpgradeId,
} from "@/lib/renovation-scene"

const EXTERIOR_SRC = "/renovation-styles/option-b-exterior.png"
const INTERIOR_SRC = "/renovation-styles/reveal-interior.png"

/* ------------------------------------------------------------------ *
 * Hotspot positions, tuned to the interior cutaway render (% of stage)
 * ------------------------------------------------------------------ */
const PIN_POS: Record<UpgradeId, { x: number; y: number }> = {
  roof: { x: 52, y: 20 },
  insulation: { x: 40, y: 27 },
  windows: { x: 17, y: 37 },
  siding: { x: 13, y: 47 },
  doors: { x: 60, y: 59 },
  electrical: { x: 53, y: 72 },
  hvac: { x: 39, y: 71 },
  plumbing: { x: 58, y: 66 },
  waterHeater: { x: 45, y: 75 },
  flooring: { x: 40, y: 63 },
  lighting: { x: 47, y: 46 },
  bathroom: { x: 70, y: 52 },
  kitchen: { x: 26, y: 52 },
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  return reduced
}

export function RenovationExplorer() {
  const reducedMotion = useReducedMotion()

  const [selectedIds, setSelectedIds] = useState<UpgradeId[]>([])
  const [active, setActive] = useState<UpgradeId | null>(null)
  // 0 = closed exterior (default), 1 = fully revealed interior cutaway.
  const [reveal, setReveal] = useState(0)

  const plan = useMemo(() => computePlan(selectedIds), [selectedIds])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const toggle = (id: UpgradeId) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }
  const addRecommended = () => {
    if (plan.recommendedNext) {
      const id = plan.recommendedNext.id
      setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      setActive(id)
    }
  }
  const reset = () => {
    setSelectedIds([])
    setActive(null)
    setReveal(0)
  }

  const interiorOpacity = reveal
  const exteriorOpacity = 1 - reveal
  // Pins fade in slightly after the house starts opening, and only become
  // clickable once the interior is clearly visible.
  const pinOpacity = Math.max(0, Math.min(1, (reveal - 0.12) / 0.3))
  const pinsInteractive = pinOpacity > 0.35
  const isOpen = reveal > 0.5

  return (
    <section
      aria-label="Interactive Home Upgrade Explorer"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Home className="size-4" aria-hidden="true" />
          </span>
          <h3 className="text-lg font-semibold text-foreground">
            Interactive Home Upgrade Explorer
          </h3>
        </div>
        <p className="text-pretty text-sm text-muted-foreground">
          Slide the house open to peek inside, then tap an upgrade to build a
          plan and see what to tackle first. Illustrative national-average
          figures, not an inspection or a quote.
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        {/* Left column — reveal control + plan */}
        <div className="flex shrink-0 flex-col gap-3 lg:w-72">
          {/* Reveal control */}
          <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                View
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {isOpen ? (
                  <>
                    <Eye className="size-3" aria-hidden="true" /> Interior
                  </>
                ) : (
                  <>
                    <Home className="size-3" aria-hidden="true" /> Exterior
                  </>
                )}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={reveal}
              onChange={(e) => setReveal(Number.parseFloat(e.target.value))}
              className="reno-reveal-slider h-2.5 w-full cursor-pointer appearance-none rounded-full"
              aria-label="Reveal interior"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Closed</span>
              <span>Open</span>
            </div>
            <button
              type="button"
              onClick={() => setReveal((r) => (r > 0.5 ? 0 : 1))}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:brightness-105"
            >
              <Eye className="size-4" aria-hidden="true" />
              {isOpen ? "Close the house" : "Peek inside"}
            </button>
          </div>

          {/* Plan summary */}
          <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your plan
              </span>
              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {plan.count} item{plan.count === 1 ? "" : "s"}
              </span>
            </div>

            {plan.count === 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                No upgrades chosen yet. Open the house and tap a marker, or add
                the recommended first step below.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Metric
                  label="Est. cost"
                  value={moneyRange(plan.totalLow, plan.totalHigh)}
                  accent
                  wide
                />
                <Metric
                  icon={<Zap className="size-3.5" aria-hidden="true" />}
                  label="Energy / yr"
                  value={money(plan.annualEnergySavings)}
                />
                <Metric
                  icon={<TrendingUp className="size-3.5" aria-hidden="true" />}
                  label="Resale add"
                  value={money(plan.resaleAdded)}
                />
              </div>
            )}

            {/* Recommended next */}
            {plan.recommendedNext && (
              <div className="mt-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-2.5">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  <Sparkles className="size-3" aria-hidden="true" /> Do this next
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {plan.recommendedNext.label}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {TIER_LABELS[plan.recommendedNext.tier]} ·{" "}
                  {moneyRange(
                    plan.recommendedNext.cost.low,
                    plan.recommendedNext.cost.high,
                  )}
                </p>
                <button
                  type="button"
                  onClick={addRecommended}
                  className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary bg-background px-2.5 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/10"
                >
                  <Plus className="size-3" aria-hidden="true" /> Add to plan
                </button>
              </div>
            )}

            {plan.count > 0 && (
              <button
                type="button"
                onClick={reset}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" /> Clear plan
              </button>
            )}
          </div>
        </div>

        {/* Clay diorama stage */}
        <div
          className="relative flex-1 overflow-hidden rounded-3xl border border-border"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 22%, #f7efdf 0%, #f4ecda 60%, #f1e7d3 100%)",
          }}
        >
          <div className="relative mx-auto aspect-[4/3] w-full max-w-3xl">
            {/* Floating shadow */}
            <div
              className="pointer-events-none absolute left-1/2 bottom-[10%] h-[8%] w-[60%] -translate-x-1/2 rounded-[50%] bg-black/20 blur-xl"
              aria-hidden="true"
            />

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={EXTERIOR_SRC || "/placeholder.svg"}
              alt="Clay model house, exterior"
              className="absolute inset-0 size-full object-contain transition-opacity duration-200"
              style={{
                opacity: exteriorOpacity,
                filter: "drop-shadow(0 20px 24px rgba(90,60,25,0.26))",
              }}
              crossOrigin="anonymous"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={INTERIOR_SRC || "/placeholder.svg"}
              alt="Clay model house, interior cutaway showing rooms and systems"
              className="absolute inset-0 size-full object-contain transition-opacity duration-200"
              style={{
                opacity: interiorOpacity,
                filter: "drop-shadow(0 20px 24px rgba(90,60,25,0.26))",
              }}
              crossOrigin="anonymous"
            />

            {/* Hotspots (fade in as the house opens) */}
            <div
              className="absolute inset-0 transition-opacity duration-200"
              style={{
                opacity: pinOpacity,
                pointerEvents: pinsInteractive ? "auto" : "none",
              }}
            >
              {UPGRADES.map((u) => {
                const pos = PIN_POS[u.id]
                const isSel = selectedSet.has(u.id)
                const isActive = active === u.id
                const color = TIER_COLORS[u.tier]
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setActive(isActive ? null : u.id)}
                    aria-label={u.label}
                    aria-pressed={isActive}
                    className="group absolute -translate-x-1/2 -translate-y-1/2 outline-none"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                  >
                    <span className="relative flex size-5 items-center justify-center">
                      {!reducedMotion && !isSel && (
                        <span
                          className="absolute inline-flex size-full animate-ping rounded-full"
                          style={{ background: `${color}55` }}
                        />
                      )}
                      <span
                        className={cn(
                          "relative inline-flex items-center justify-center rounded-full border-2 border-white shadow-md transition-transform group-hover:scale-125 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                          isActive ? "size-5 scale-110" : "size-4",
                        )}
                        style={{ background: color }}
                      >
                        {isSel && (
                          <Check
                            className="size-2.5 text-white"
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </span>
                  </button>
                )
              })}

              {active && (
                <UpgradeCard
                  id={active}
                  selected={selectedSet.has(active)}
                  onToggle={() => toggle(active)}
                  onClose={() => setActive(null)}
                />
              )}
            </div>

            {/* Prompt when the house is closed */}
            {!isOpen && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-card/85 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-md">
                  <DoorOpen className="size-3.5 text-primary" aria-hidden="true" />
                  Drag the View slider to open the house
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade catalog */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">
            All upgrades
          </span>
          {/* Tier legend */}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {(["safety", "high", "medium", "low"] as PriorityTier[]).map(
              (tier) => (
                <span
                  key={tier}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                >
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ background: TIER_COLORS[tier] }}
                    aria-hidden="true"
                  />
                  {TIER_LABELS[tier]}
                </span>
              ),
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {GROUP_ORDER.map((group) => (
            <div key={group} className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {GROUP_LABELS[group as UpgradeGroup]}
              </p>
              <div className="flex flex-col gap-1.5">
                {UPGRADES.filter((u) => u.group === group)
                  .sort((a, b) => b.priorityScore - a.priorityScore)
                  .map((u) => {
                    const isSel = selectedSet.has(u.id)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          toggle(u.id)
                          setActive(u.id)
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs transition-colors",
                          isSel
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-background text-foreground hover:bg-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                            isSel
                              ? "border-transparent"
                              : "border-current opacity-60",
                          )}
                          style={
                            isSel ? { background: TIER_COLORS[u.tier] } : undefined
                          }
                        >
                          {isSel && (
                            <Check
                              className="size-2.5 text-white"
                              strokeWidth={3}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                        <span className="flex-1">{u.label}</span>
                        <span className="tabular-nums text-[10px] text-muted-foreground">
                          {money(u.cost.low)}+
                        </span>
                      </button>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          Priority order and figures are national-average estimates for
          education only — not a professional inspection or a firm quote. Get
          local bids before committing.
        </p>
      </div>

      <style jsx>{`
        .reno-reveal-slider {
          background: linear-gradient(90deg, #d8cdb8 0%, #c0563c 100%);
        }
        .reno-reveal-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid var(--primary);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
          cursor: pointer;
        }
        .reno-reveal-slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid var(--primary);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
          cursor: pointer;
        }
      `}</style>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Metric tile
 * ------------------------------------------------------------------ */
function Metric({
  icon,
  label,
  value,
  accent,
  wide,
}: {
  icon?: React.ReactNode
  label: string
  value: string
  accent?: boolean
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl border p-2",
        wide && "col-span-2",
        accent ? "border-primary/30 bg-primary/5" : "border-border bg-background",
      )}
    >
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Floating upgrade info card
 * ------------------------------------------------------------------ */
function UpgradeCard({
  id,
  selected,
  onToggle,
  onClose,
}: {
  id: UpgradeId
  selected: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const u = UPGRADE_BY_ID[id]
  const pos = PIN_POS[id]
  const flip = pos.x > 55
  const rank = RECOMMENDED_ORDER.findIndex((x) => x.id === id) + 1
  return (
    <div
      className="absolute z-10 w-60 -translate-y-1/2 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md"
      style={{
        top: `${Math.min(76, Math.max(24, pos.y))}%`,
        left: flip ? undefined : `${Math.min(pos.x + 5, 50)}%`,
        right: flip ? `${Math.min(100 - pos.x + 5, 50)}%` : undefined,
      }}
      role="dialog"
      aria-label={u.label}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block size-3 rounded-full"
            style={{ background: TIER_COLORS[u.tier] }}
            aria-hidden="true"
          />
          <h4 className="text-sm font-semibold text-foreground">{u.label}</h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
        <span className="font-medium text-primary">{TIER_LABELS[u.tier]}</span>
        <span className="text-muted-foreground">· Priority #{rank} of 13</span>
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {u.blurb}
      </p>

      <dl className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
        <div className="rounded-lg bg-muted/60 px-2 py-1">
          <dt className="text-muted-foreground">Est. cost</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {moneyRange(u.cost.low, u.cost.high)}
          </dd>
        </div>
        <div className="rounded-lg bg-muted/60 px-2 py-1">
          <dt className="text-muted-foreground">Energy / yr</dt>
          <dd className="font-semibold tabular-nums text-foreground">
            {u.annualEnergySavings > 0 ? money(u.annualEnergySavings) : "—"}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
          selected
            ? "border-border bg-background text-foreground hover:bg-muted"
            : "border-primary bg-primary text-primary-foreground hover:brightness-105",
        )}
      >
        {selected ? (
          <>
            <Check className="size-4" aria-hidden="true" /> In your plan
          </>
        ) : (
          <>
            <Plus className="size-4" aria-hidden="true" /> Add to plan
          </>
        )}
      </button>
    </div>
  )
}

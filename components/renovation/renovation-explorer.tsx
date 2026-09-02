"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  Bath,
  Check,
  DoorOpen,
  Droplets,
  Fan,
  Flame,
  Home,
  Layers,
  LayoutGrid,
  Lightbulb,
  ListChecks,
  PanelTop,
  Plus,
  RotateCcw,
  Sparkles,
  Thermometer,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
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
  ROOMS,
  TIER_COLORS,
  TIER_LABELS,
  UPGRADE_BY_ID,
  UPGRADES,
  type PriorityTier,
  type Upgrade,
  type UpgradeGroup,
  type UpgradeId,
} from "@/lib/renovation-scene"

// Per-upgrade icon, so each clay pin reads as its system at a glance.
const UPGRADE_ICON: Record<UpgradeId, React.ComponentType<{ className?: string }>> = {
  roof: Home,
  insulation: Thermometer,
  windows: PanelTop,
  siding: Layers,
  doors: DoorOpen,
  electrical: Zap,
  hvac: Fan,
  plumbing: Droplets,
  waterHeater: Flame,
  flooring: LayoutGrid,
  lighting: Lightbulb,
  bathroom: Bath,
  kitchen: UtensilsCrossed,
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
  const [selected, setSelected] = useState<UpgradeId[]>([])
  const [active, setActive] = useState<UpgradeId | null>(null)
  const [groupFilter, setGroupFilter] = useState<UpgradeGroup | "all">("all")
  const [prioritize, setPrioritize] = useState(false)
  const reducedMotion = useReducedMotion()
  const stageRef = useRef<HTMLDivElement>(null)

  const plan = useMemo(() => computePlan(selected), [selected])
  const activeUpgrade = active ? UPGRADE_BY_ID[active] : null
  const selectedSet = useMemo(() => new Set(selected), [selected])

  const rankOf = (id: UpgradeId) =>
    RECOMMENDED_ORDER.findIndex((u) => u.id === id) + 1

  function togglePlan(id: UpgradeId) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function scrollToStage() {
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <section
      aria-label="Interactive Home Upgrade Explorer"
      className="flex flex-col gap-8"
    >
      {/* Hero */}
      <header className="flex flex-col gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Home Upgrade Explorer
        </span>
        <h2 className="max-w-2xl text-balance font-serif text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          See what your home should upgrade next.
        </h2>
        <p className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
          Explore your home room by room, compare improvements, and build a
          renovation plan that fits your priorities and budget.
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={scrollToStage}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Explore your home
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
          <a
            href="#home-upgrade-advisor"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Get upgrade recommendations
          </a>
        </div>
      </header>

      {/* Simulator row: plan panel + clay cutaway house */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
        <PlanPanel
          plan={plan}
          selected={selected}
          onRemove={(id) => togglePlan(id)}
          onFocus={(id) => setActive(id)}
          onClear={() => setSelected([])}
          onAddRecommended={(id) => {
            togglePlan(id)
            setActive(id)
          }}
        />

        {/* Stage */}
        <div className="flex flex-1 flex-col gap-3">
          <div
            ref={stageRef}
            className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-[2rem] scroll-mt-24"
            style={{
              background:
                "radial-gradient(120% 100% at 50% 0%, #f7f1e6 0%, #efe6d5 55%, #e7dcc7 100%)",
              boxShadow: "inset 0 2px 30px rgba(120,95,60,0.12)",
            }}
          >
            <ClayHouse
              upgrades={UPGRADES}
              active={active}
              selectedSet={selectedSet}
              groupFilter={groupFilter}
              prioritize={prioritize}
              reducedMotion={reducedMotion}
              rankOf={rankOf}
              onSelect={(id) => setActive((cur) => (cur === id ? null : id))}
            />

            {/* Floating detail card */}
            {activeUpgrade ? (
              <UpgradeCard
                upgrade={activeUpgrade}
                inPlan={selectedSet.has(activeUpgrade.id)}
                rank={rankOf(activeUpgrade.id)}
                onToggle={() => togglePlan(activeUpgrade.id)}
                onClose={() => setActive(null)}
              />
            ) : (
              <p className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm sm:block">
                Tap a marker to explore an upgrade
              </p>
            )}
          </div>

          {/* Controls: group filter + prioritize toggle + legend */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                active={groupFilter === "all"}
                onClick={() => setGroupFilter("all")}
              >
                All areas
              </FilterChip>
              {GROUP_ORDER.map((g) => (
                <FilterChip
                  key={g}
                  active={groupFilter === g}
                  onClick={() => setGroupFilter(g)}
                >
                  {GROUP_LABELS[g]}
                </FilterChip>
              ))}
              <button
                type="button"
                onClick={() => setPrioritize((p) => !p)}
                aria-pressed={prioritize}
                className={cn(
                  "ml-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  prioritize
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-ring hover:text-foreground",
                )}
              >
                <ListChecks className="size-4" aria-hidden="true" />
                {prioritize ? "Showing order" : "What first?"}
              </button>
            </div>

            <TierLegend prioritize={prioritize} />
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Clay cutaway house
// ---------------------------------------------------------------------------
function ClayHouse({
  upgrades,
  active,
  selectedSet,
  groupFilter,
  prioritize,
  reducedMotion,
  rankOf,
  onSelect,
}: {
  upgrades: Upgrade[]
  active: UpgradeId | null
  selectedSet: Set<UpgradeId>
  groupFilter: UpgradeGroup | "all"
  prioritize: boolean
  reducedMotion: boolean
  rankOf: (id: UpgradeId) => number
  onSelect: (id: UpgradeId) => void
}) {
  return (
    <div className="absolute inset-0" aria-hidden={false}>
      {/* Ground shadow under the model */}
      <span className="absolute inset-x-[10%] bottom-[5%] h-6 rounded-[50%] bg-[rgba(120,90,55,0.22)] blur-lg" />

      {/* House envelope (outer walls) */}
      <div
        className="absolute rounded-[1.6rem]"
        style={{
          left: "6%",
          right: "6%",
          top: "13%",
          bottom: "7%",
          background: "linear-gradient(165deg, #e9dcc2 0%, #dccbaa 100%)",
          boxShadow:
            "0 22px 40px rgba(110,80,50,0.24), inset 0 3px 5px rgba(255,255,255,0.55)",
        }}
      />

      {/* Floor-plan container with the rooms */}
      <div
        className="absolute"
        style={{ left: "13%", right: "13%", top: "27%", bottom: "12%" }}
      >
        {ROOMS.map((room) => (
          <div
            key={room.id}
            className="absolute p-1.5"
            style={{
              left: `${room.x}%`,
              top: `${room.y}%`,
              width: `${room.w}%`,
              height: `${room.h}%`,
            }}
          >
            <div
              className="flex size-full items-start justify-start rounded-[0.7rem] p-2"
              style={{
                background: `linear-gradient(160deg, ${room.color} 0%, ${shade(room.color, -10)} 100%)`,
                boxShadow:
                  "inset 0 2px 3px rgba(255,255,255,0.5), inset 0 -3px 5px rgba(120,95,60,0.16), 0 2px 4px rgba(110,80,50,0.12)",
              }}
            >
              <span className="select-none text-[10px] font-medium uppercase tracking-wide text-[rgba(90,70,45,0.62)]">
                {room.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Roof band across the top, with a peeled-back corner to imply cutaway */}
      <div
        className="absolute overflow-hidden rounded-t-[1.6rem]"
        style={{
          left: "6%",
          right: "6%",
          top: "13%",
          height: "15%",
          background: "linear-gradient(165deg, #cf8055 0%, #b1663f 100%)",
          boxShadow: "inset 0 3px 6px rgba(255,255,255,0.28)",
        }}
      >
        {/* ridge line */}
        <span className="absolute inset-x-8 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[rgba(120,70,45,0.4)]" />
        {/* peeled corner — a lighter underside folded back on the right */}
        <span
          className="absolute right-0 top-0 h-full w-1/3"
          style={{
            background: "linear-gradient(115deg, transparent 45%, #e7c9a5 45%)",
          }}
        />
      </div>

      {/* Front door notch at the bottom center */}
      <span
        className="absolute bottom-[7%] left-1/2 h-[5%] w-[10%] -translate-x-1/2 rounded-b-md"
        style={{ background: "linear-gradient(180deg, #b1663f, #96522f)" }}
      />

      {/* Hotspots */}
      {upgrades.map((u) => (
        <Hotspot
          key={u.id}
          upgrade={u}
          active={active === u.id}
          inPlan={selectedSet.has(u.id)}
          dim={groupFilter !== "all" && u.group !== groupFilter}
          prioritize={prioritize}
          rank={rankOf(u.id)}
          reducedMotion={reducedMotion}
          onSelect={() => onSelect(u.id)}
        />
      ))}
    </div>
  )
}

function Hotspot({
  upgrade,
  active,
  inPlan,
  dim,
  prioritize,
  rank,
  reducedMotion,
  onSelect,
}: {
  upgrade: Upgrade
  active: boolean
  inPlan: boolean
  dim: boolean
  prioritize: boolean
  rank: number
  reducedMotion: boolean
  onSelect: () => void
}) {
  const Icon = UPGRADE_ICON[upgrade.id]
  const color = TIER_COLORS[upgrade.tier]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${upgrade.label} — ${TIER_LABELS[upgrade.tier]}`}
      aria-pressed={active}
      className={cn(
        "group absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-[opacity,transform] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        dim ? "opacity-25" : "opacity-100",
        active && "z-20 scale-110",
      )}
      style={{ left: `${upgrade.x}%`, top: `${upgrade.y}%` }}
    >
      <span className="relative flex size-7 items-center justify-center">
        {!reducedMotion && !dim && (active || inPlan) ? (
          <span
            className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
            style={{ background: color }}
          />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-7 items-center justify-center rounded-full border-2 border-white text-white shadow-md transition-transform group-hover:scale-110",
            active && "ring-2 ring-white",
          )}
          style={{ background: color }}
        >
          {prioritize ? (
            <span className="text-[11px] font-bold tabular-nums">{rank}</span>
          ) : (
            <Icon className="size-3.5" />
          )}
        </span>
        {inPlan ? (
          <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full border border-white bg-primary text-primary-foreground">
            <Check className="size-2.5" aria-hidden="true" />
          </span>
        ) : null}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Floating upgrade detail card
// ---------------------------------------------------------------------------
function UpgradeCard({
  upgrade,
  inPlan,
  rank,
  onToggle,
  onClose,
}: {
  upgrade: Upgrade
  inPlan: boolean
  rank: number
  onToggle: () => void
  onClose: () => void
}) {
  const color = TIER_COLORS[upgrade.tier]
  return (
    <div className="absolute inset-x-3 bottom-3 z-30 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-xl backdrop-blur-md sm:inset-x-auto sm:left-1/2 sm:w-[24rem] sm:-translate-x-1/2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex size-2.5 rounded-full"
              style={{ background: color }}
              aria-hidden="true"
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color }}
            >
              {TIER_LABELS[upgrade.tier]}
            </span>
            <span className="text-[11px] text-muted-foreground">
              · Recommended step #{rank}
            </span>
          </div>
          <h3 className="font-serif text-lg font-semibold text-foreground">
            {upgrade.label}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {upgrade.blurb}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Est. cost" value={moneyRange(upgrade.cost.low, upgrade.cost.high)} wide />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <MiniStat
          label="Energy / yr"
          value={upgrade.annualEnergySavings ? money(upgrade.annualEnergySavings) : "—"}
        />
        <MiniStat label="Comfort" value={"●".repeat(upgrade.comfortGain) || "—"} />
        <MiniStat label="Resale" value={`${Math.round(upgrade.resaleRecovery * 100)}%`} />
      </div>

      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
          inPlan
            ? "border border-border bg-background text-foreground hover:border-ring"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {inPlan ? (
          <>
            <Check className="size-4" aria-hidden="true" />
            In your plan — remove
          </>
        ) : (
          <>
            <Plus className="size-4" aria-hidden="true" />
            Add to my plan
          </>
        )}
      </button>
    </div>
  )
}

function MiniStat({
  label,
  value,
  wide,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-muted/40 px-2 py-1.5",
        wide && "col-span-3",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-serif text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plan panel (left column on desktop, below stage on mobile)
// ---------------------------------------------------------------------------
function PlanPanel({
  plan,
  selected,
  onRemove,
  onFocus,
  onClear,
  onAddRecommended,
}: {
  plan: ReturnType<typeof computePlan>
  selected: UpgradeId[]
  onRemove: (id: UpgradeId) => void
  onFocus: (id: UpgradeId) => void
  onClear: () => void
  onAddRecommended: (id: UpgradeId) => void
}) {
  const next = plan.recommendedNext
  return (
    <aside className="order-2 flex shrink-0 flex-col gap-3 lg:order-1 lg:w-72">
      {/* Start here recommendation */}
      {next ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/8 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {plan.count === 0 ? "Start here" : "Do this next"}
          </div>
          <p className="mt-1.5 font-serif text-lg font-semibold text-foreground">
            {next.label}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {TIER_LABELS[next.tier]} · {moneyRange(next.cost.low, next.cost.high)}
          </p>
          <button
            type="button"
            onClick={() => onAddRecommended(next.id)}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add to plan
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-primary/30 bg-primary/8 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
            <Check className="size-3.5" aria-hidden="true" />
            Full plan
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Every upgrade is in your plan. Remove any that can wait to sharpen
            your priorities.
          </p>
        </div>
      )}

      {/* Plan list */}
      <div className="flex flex-1 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 font-serif text-base font-semibold text-foreground">
            <ListChecks className="size-4 text-muted-foreground" aria-hidden="true" />
            Your plan
          </h3>
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Clear
            </button>
          ) : null}
        </div>

        {selected.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Tap a marker on the house, then add upgrades to build a prioritized
            renovation plan.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {selected.map((id) => {
              const u = UPGRADE_BY_ID[id]
              const Icon = UPGRADE_ICON[id]
              return (
                <li key={id}>
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-2 py-1.5">
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-white"
                      style={{ background: TIER_COLORS[u.tier] }}
                    >
                      <Icon className="size-3" />
                    </span>
                    <button
                      type="button"
                      onClick={() => onFocus(id)}
                      className="flex min-w-0 flex-1 flex-col items-start text-left"
                    >
                      <span className="truncate text-sm font-medium text-foreground">
                        {u.label}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {moneyRange(u.cost.low, u.cost.high)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(id)}
                      aria-label={`Remove ${u.label}`}
                      className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Totals */}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
          <PlanMetric
            icon={<Wallet className="size-3.5" aria-hidden="true" />}
            label="Est. cost"
            value={
              plan.count === 0
                ? "—"
                : moneyRange(plan.totalLow, plan.totalHigh)
            }
            highlight
            wide
          />
          <PlanMetric
            icon={<Zap className="size-3.5" aria-hidden="true" />}
            label="Energy / yr"
            value={plan.annualEnergySavings ? money(plan.annualEnergySavings) : "—"}
          />
          <PlanMetric
            icon={<TrendingUp className="size-3.5" aria-hidden="true" />}
            label="Resale added"
            value={plan.resaleAdded ? money(plan.resaleAdded) : "—"}
          />
        </div>
      </div>
    </aside>
  )
}

function PlanMetric({
  icon,
  label,
  value,
  highlight,
  wide,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl border p-2.5",
        wide && "col-span-2",
        highlight ? "border-primary/30 bg-primary/8" : "border-border bg-muted/30",
      )}
    >
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-serif text-base font-semibold tabular-nums text-foreground">
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small shared UI
// ---------------------------------------------------------------------------
function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border bg-background text-muted-foreground hover:border-ring hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function TierLegend({ prioritize }: { prioritize: boolean }) {
  const tiers: PriorityTier[] = ["safety", "high", "medium", "low"]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {tiers.map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className="inline-flex size-2.5 rounded-full"
            style={{ background: TIER_COLORS[t] }}
            aria-hidden="true"
          />
          {TIER_LABELS[t]}
        </span>
      ))}
      <span className="text-[11px] text-muted-foreground/70">
        {prioritize
          ? "Numbers show the suggested order"
          : "Colour shows priority"}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Colour helper — darken a hex by a percentage for the clay bottom-shade.
// ---------------------------------------------------------------------------
function shade(hex: string, percent: number): string {
  const n = hex.replace("#", "")
  const num = Number.parseInt(n, 16)
  const amt = Math.round(2.55 * percent)
  const r = Math.max(0, Math.min(255, (num >> 16) + amt))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt))
  const b = Math.max(0, Math.min(255, (num & 0xff) + amt))
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

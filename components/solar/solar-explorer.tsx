"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import {
  BatteryCharging,
  Home,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSolarScene } from "@/components/solar/solar-scene-context"
import {
  COMPONENT_INFO,
  frameIndexForHour,
  kw,
  money,
  type ComponentId,
} from "@/lib/solar-scene"

// ---------------------------------------------------------------------------
// The original claymation landscape diorama with its flat backdrop flood-filled
// to genuine transparency, so it sits on the page with no surrounding box.
// ---------------------------------------------------------------------------
const DIORAMA_SRC = "/solar-styles/claymation-cutout.png"

// Hotspots: percentage positions tuned to the widened diorama (1324x1024) so a
// marker lands on the real object. x/y are percentages of the stage box.
type Hotspot = { id: ComponentId; x: number; y: number }

const HOTSPOTS: Hotspot[] = [
  { id: "sun", x: 32, y: 20 },
  { id: "panels", x: 56, y: 37 },
  { id: "home", x: 58, y: 52 },
  { id: "inverter", x: 41, y: 52 },
  { id: "battery", x: 44, y: 58 },
  { id: "grid", x: 79, y: 27 },
]

// Energy-flow segments drawn between hotspots. `key` selects the flow value on
// the current frame; `always` flows depend only on solar generation.
type Segment = {
  from: ComponentId
  to: ComponentId
  color: string
  key?: "solarToHome" | "solarToBattery" | "solarToGrid" | "gridToHome" | "batteryToHome"
  solarDriven?: boolean
}

const SEGMENTS: Segment[] = [
  { from: "sun", to: "panels", color: "#f5b445", solarDriven: true },
  { from: "panels", to: "inverter", color: "#f5b445", solarDriven: true },
  { from: "inverter", to: "home", color: "#f5b445", key: "solarToHome" },
  { from: "inverter", to: "battery", color: "#9b83f0", key: "solarToBattery" },
  { from: "battery", to: "home", color: "#9b83f0", key: "batteryToHome" },
  { from: "inverter", to: "grid", color: "#3fae82", key: "solarToGrid" },
  { from: "grid", to: "home", color: "#5b8def", key: "gridToHome" },
]

const LEGEND: Array<{ label: string; color: string }> = [
  { label: "Solar to home", color: "#f5b445" },
  { label: "Export to grid", color: "#3fae82" },
  { label: "Grid to home", color: "#5b8def" },
  { label: "Battery", color: "#9b83f0" },
]

const TICKS: Array<{ label: string; icon: typeof Sun }> = [
  { label: "Morning", icon: Sunrise },
  { label: "Midday", icon: Sun },
  { label: "Evening", icon: Sunset },
  { label: "Night", icon: Moon },
]

const DAY_SECONDS = 18 // one simulated day plays over ~18s

export function SolarExplorer() {
  const { snapshot, timeline, isLive } = useSolarScene()

  const [hour, setHour] = useState(12)
  const [playing, setPlaying] = useState(false)
  const [selected, setSelected] = useState<ComponentId | null>(null)
  const [showSavings, setShowSavings] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Respect the user's reduced-motion preference.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => {
      setReducedMotion(mq.matches)
      if (mq.matches) setPlaying(false)
    }
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  // "Run day" animation loop.
  const raf = useRef<number | null>(null)
  const last = useRef<number | null>(null)
  useEffect(() => {
    if (!playing || reducedMotion) return
    const tick = (now: number) => {
      if (last.current != null) {
        const dtSec = (now - last.current) / 1000
        setHour((h) => {
          const next = h + dtSec * (24 / DAY_SECONDS)
          return next >= 24 ? next - 24 : next
        })
      }
      last.current = now
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
      last.current = null
    }
  }, [playing, reducedMotion])

  const frame = useMemo(() => {
    const idx = frameIndexForHour(timeline, hour)
    return timeline.frames[idx]
  }, [timeline, hour])

  const hotspots = HOTSPOTS
  const posOf = useMemo(() => {
    const map = {} as Record<ComponentId, Hotspot>
    for (const h of hotspots) map[h.id] = h
    return map
  }, [hotspots])

  const gridExporting = frame.gridKw > 0.05
  const gridImporting = frame.gridKw < -0.05
  const dayPct = (hour / 24) * 100

  function handleReset() {
    setSelected(null)
    setPlaying(false)
    setHour(12)
    setShowSavings(false)
  }

  // Which segments are currently carrying energy.
  const activeSegments = SEGMENTS.map((seg) => {
    const active = seg.solarDriven
      ? frame.solarKw > 0.05
      : seg.key
        ? frame.flows[seg.key] > 0.05
        : false
    return { seg, active }
  })

  return (
    <section aria-label="Solar Energy Explorer" className="flex flex-col gap-4">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary">
            <Sparkles className="size-3" aria-hidden="true" />
            Interactive diagram
          </span>
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            Solar Energy Explorer
          </h2>
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            See how a home solar system works. Tap any part to learn what it
            does, and run a day to watch energy flow from the sun to your home,
            battery, and the grid. Complete a calculator below and the numbers
            update to match your home.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-sm",
            isLive
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          <span className="relative flex size-1.5">
            {isLive ? (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/70" />
            ) : null}
            <span
              className={cn(
                "relative inline-flex size-1.5 rounded-full",
                isLive ? "bg-primary" : "bg-muted-foreground",
              )}
            />
          </span>
          {isLive ? "Live from your calculator" : "Sample data"}
        </span>
      </div>

      {/* Stage — frameless with a transparent-backed diorama, so the clay
          model sits on the page with no surrounding box. Aspect matches the
          widened image so the full lawn shows without cropping. */}
      <div className="relative mx-auto aspect-[1324/1024] w-full max-w-3xl">
        {/* Transparent diorama (real alpha). A soft drop shadow now follows the
            model silhouette rather than a rectangle. */}
        <Image
          src={DIORAMA_SRC || "/placeholder.svg"}
          alt="Claymation model of a home solar system"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 672px"
          className="object-contain [filter:drop-shadow(0_16px_20px_rgba(24,20,10,0.18))]"
        />

          {/* Energy-flow overlay */}
          <svg
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-0 size-full"
            aria-hidden="true"
          >
            {activeSegments.map(({ seg, active }) => {
              const a = posOf[seg.from]
              const b = posOf[seg.to]
              if (!a || !b) return null
              return (
                <line
                  key={`${seg.from}-${seg.to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={seg.color}
                  strokeWidth={active ? 0.9 : 0.5}
                  strokeLinecap="round"
                  strokeDasharray="2 2.5"
                  className={cn(
                    "transition-opacity duration-500",
                    active ? "opacity-90 solar-flow" : "opacity-0",
                  )}
                  style={{
                    filter: active ? `drop-shadow(0 0 1px ${seg.color})` : undefined,
                  }}
                />
              )
            })}
          </svg>

          {/* Hotspots */}
          {hotspots.map((h) => {
            const info = COMPONENT_INFO[h.id]
            const isSel = selected === h.id
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => setSelected(isSel ? null : h.id)}
                aria-label={`Learn about ${info.title}`}
                aria-pressed={isSel}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${h.x}%`, top: `${h.y}%` }}
              >
                <span className="relative flex size-5 items-center justify-center">
                  {!reducedMotion ? (
                    <span
                      className={cn(
                        "absolute inline-flex size-full rounded-full",
                        isSel ? "bg-primary/40" : "bg-primary/30 animate-ping",
                      )}
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative inline-flex size-3.5 rounded-full border-2 border-white shadow-md transition-all group-hover:scale-125",
                      isSel ? "bg-primary scale-125" : "bg-primary/90",
                    )}
                  />
                </span>
              </button>
            )
          })}

          {/* Selected component popup */}
          {selected ? (
            <SelectedCard
              id={selected}
              pos={posOf[selected]}
              onClose={() => setSelected(null)}
            />
          ) : null}

          {/* Live stats (bottom-left corner, over empty margin) */}
          <div className="absolute -bottom-1 left-0 w-40 overflow-hidden rounded-xl border border-white/50 bg-card/90 shadow-lg ring-1 ring-black/5 backdrop-blur-md sm:w-48">
            <div className="flex items-center justify-between border-b border-border/60 bg-gradient-to-r from-primary/12 to-transparent px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Right now
              </p>
              <span className="rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-foreground">
                {frame.label}
              </span>
            </div>
            <dl className="flex flex-col gap-1.5 px-3 py-2.5 text-sm">
              <StatRow
                icon={<Sun className="size-3.5 text-primary" aria-hidden="true" />}
                label="Solar"
                value={kw(frame.solarKw)}
              />
              <StatRow
                icon={<Home className="size-3.5 text-chart-3" aria-hidden="true" />}
                label="Home"
                value={kw(frame.consumptionKw)}
              />
              <StatRow
                icon={<Zap className="size-3.5 text-chart-2" aria-hidden="true" />}
                label={gridImporting ? "Grid in" : "Grid out"}
                value={kw(Math.abs(frame.gridKw))}
                valueClass={
                  gridExporting
                    ? "text-chart-2"
                    : gridImporting
                      ? "text-chart-3"
                      : undefined
                }
              />
              {snapshot.hasBattery ? (
                <StatRow
                  icon={
                    <BatteryCharging
                      className="size-3.5 text-[#9b83f0]"
                      aria-hidden="true"
                    />
                  }
                  label="Battery"
                  value={`${Math.round(frame.batterySoc * 100)}%`}
                />
              ) : null}
            </dl>
            <div className="border-t border-border/60 bg-gradient-to-r from-primary/8 to-transparent px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Saved today</p>
              <p className="font-serif text-xl tabular-nums text-foreground">
                {money(frame.savingsSoFar, 2)}
              </p>
            </div>
          </div>

          {/* Savings breakdown (toggled) */}
          {showSavings ? (
            <div className="absolute right-3 top-3 w-52 overflow-hidden rounded-xl border border-white/50 bg-card/85 shadow-lg ring-1 ring-black/5 backdrop-blur-md">
              <p className="border-b border-border/60 bg-gradient-to-r from-primary/12 to-transparent px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Yearly bill
              </p>
              <dl className="flex flex-col gap-2 px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Without solar</dt>
                  <dd className="tabular-nums">
                    {snapshot.billWithoutSolar != null
                      ? money(snapshot.billWithoutSolar)
                      : "—"}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">With solar</dt>
                  <dd className="tabular-nums">
                    {snapshot.billWithSolar == null
                      ? "—"
                      : snapshot.billWithSolar < -0.5
                        ? `${money(-snapshot.billWithSolar)} credit`
                        : money(Math.max(0, snapshot.billWithSolar))}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-2">
                  <dt className="font-medium text-foreground">You save</dt>
                  <dd className="font-serif text-lg tabular-nums text-primary">
                    {snapshot.annualSavings != null
                      ? `${money(snapshot.annualSavings)}/yr`
                      : "—"}
                  </dd>
                </div>
              </dl>
              <p className="border-t border-border/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                Covers about {Math.round(snapshot.offsetPercent)}% of a{" "}
                {snapshot.panelCount}-panel, {snapshot.systemSizeKw.toFixed(1)} kW
                system.
              </p>
            </div>
          ) : null}

          {/* Hint */}
          <div className="pointer-events-none absolute bottom-3 right-3 hidden rounded-lg border border-white/40 bg-card/75 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md sm:block">
            Tap a marker to learn more
          </div>
        </div>

      {/* Legend + flow key beneath the stage */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Energy flow
        </span>
        {LEGEND.map((item) => (
          <span
            key={item.label}
            className="flex items-center gap-1.5 text-xs font-medium text-foreground"
          >
            <span
              className="h-1 w-4 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            {item.label}
          </span>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <ControlButton
            onClick={() => setPlaying((p) => !p)}
            disabled={reducedMotion}
            active={playing}
            primary
            title={
              reducedMotion
                ? "Auto-play is off because your system prefers reduced motion — use the timeline instead."
                : undefined
            }
          >
            {playing ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            {playing ? "Pause" : "Run day"}
          </ControlButton>
          <ControlButton
            onClick={() => setShowSavings((s) => !s)}
            active={showSavings}
          >
            <Zap className="size-4" aria-hidden="true" />
            Savings
          </ControlButton>
          <ControlButton onClick={handleReset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset
          </ControlButton>
        </div>

        {/* Timeline */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="solar-timeline"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Time of day
            </label>
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-foreground">
              {frame.label}
            </span>
          </div>
          <div className="relative">
            <input
              id="solar-timeline"
              type="range"
              min={0}
              max={24}
              step={0.25}
              value={hour}
              onChange={(e) => {
                setPlaying(false)
                setHour(Number.parseFloat(e.target.value))
              }}
              className="solar-timeline h-2.5 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #1e293b 0%, #6b5b95 18%, #f5b445 40%, #ffe6a8 50%, #f5b445 60%, #6b5b95 82%, #1e293b 100%)",
              }}
              aria-label="Time of day"
            />
            <span
              className="pointer-events-none absolute -bottom-1 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"
              style={{ left: `${dayPct}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            {TICKS.map((t) => {
              const Icon = t.icon
              return (
                <span key={t.label} className="flex items-center gap-1">
                  <Icon className="size-3" aria-hidden="true" />
                  {t.label}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <style jsx>{`
        .solar-flow {
          animation: solar-flow-dash 0.8s linear infinite;
        }
        @keyframes solar-flow-dash {
          to {
            stroke-dashoffset: -4.5;
          }
        }
        .solar-timeline::-webkit-slider-thumb {
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
        .solar-timeline::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid var(--primary);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
          cursor: pointer;
        }
        @media (prefers-reduced-motion: reduce) {
          .solar-flow {
            animation: none;
          }
        }
      `}</style>
    </section>
  )
}

function SelectedCard({
  id,
  pos,
  onClose,
}: {
  id: ComponentId
  pos: Hotspot | undefined
  onClose: () => void
}) {
  const info = COMPONENT_INFO[id]
  // Anchor the card to the hotspot, flipping side/vertical to stay in frame.
  const left = pos ? Math.min(Math.max(pos.x, 28), 72) : 50
  const above = pos ? pos.y > 55 : false
  const top = pos ? (above ? pos.y - 6 : pos.y + 6) : 50
  return (
    <div
      className="absolute z-10 w-52 -translate-x-1/2 rounded-xl border border-white/60 bg-card/95 shadow-xl ring-1 ring-black/5 backdrop-blur-md"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(-50%, ${above ? "-100%" : "0"})`,
      }}
      role="dialog"
      aria-label={info.title}
    >
      <div className="flex items-start justify-between gap-2 border-b border-border/60 bg-gradient-to-r from-primary/12 to-transparent px-3 py-2">
        <p className="font-serif text-sm font-semibold text-foreground">
          {info.title}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <p className="px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        {info.blurb}
      </p>
    </div>
  )
}

function StatRow({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className={cn("font-semibold tabular-nums", valueClass)}>{value}</dd>
    </div>
  )
}

function ControlButton({
  children,
  onClick,
  active,
  primary,
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  primary?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-45",
        primary && !active
          ? "border-primary bg-primary text-primary-foreground shadow-sm hover:brightness-105"
          : active
            ? "border-primary bg-primary/15 text-foreground shadow-inner"
            : "border-input bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

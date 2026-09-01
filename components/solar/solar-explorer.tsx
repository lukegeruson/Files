"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import {
  BatteryCharging,
  Home,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Route,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useSolarScene } from "@/components/solar/solar-scene-context"
import {
  frameIndexForHour,
  kw,
  money,
  type ComponentId,
} from "@/lib/solar-scene"
import type { CameraPreset } from "@/components/solar/solar-scene-3d"

// The Canvas is client-only; load it lazily with a graceful skeleton.
const SolarScene3D = dynamic(() => import("@/components/solar/solar-scene-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-sky-200 via-sky-100 to-accent">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <span className="relative flex size-10 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
          <Sun className="size-7 text-primary" aria-hidden="true" />
        </span>
        <p className="text-sm">Loading 3D explorer…</p>
      </div>
    </div>
  ),
})

const DAY_SECONDS = 18 // one simulated day plays over ~18s

const LEGEND: Array<{ key: string; label: string; color: string }> = [
  { key: "solarToHome", label: "Solar to home", color: "#f5b445" },
  { key: "solarToGrid", label: "Export to grid", color: "#3fae82" },
  { key: "gridToHome", label: "Grid to home", color: "#5b8def" },
  { key: "batteryToHome", label: "Battery to home", color: "#9b83f0" },
]

const TICKS: Array<{ hour: number; label: string; icon: typeof Sun }> = [
  { hour: 6, label: "Morning", icon: Sunrise },
  { hour: 12, label: "Midday", icon: Sun },
  { hour: 18, label: "Evening", icon: Sunset },
  { hour: 23.5, label: "Night", icon: Moon },
]

export function SolarExplorer() {
  const { snapshot, timeline, isLive } = useSolarScene()

  const [hour, setHour] = useState(12)
  const [playing, setPlaying] = useState(false)
  const [preset, setPreset] = useState<CameraPreset>("overview")
  const [resetKey, setResetKey] = useState(0)
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

  // "Run Day" animation loop.
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

  function handleReset() {
    setPreset("overview")
    setResetKey((k) => k + 1)
    setSelected(null)
    setPlaying(false)
    setHour(12)
  }

  const gridExporting = frame.gridKw > 0.05
  const gridImporting = frame.gridKw < -0.05
  const dayPct = (hour / 24) * 100

  return (
    <section
      aria-label="3D Solar Energy Explorer"
      className="flex flex-col gap-4"
    >
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary">
            <Sparkles className="size-3" aria-hidden="true" />
            Interactive 3D
          </span>
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            Solar Energy Explorer
          </h2>
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            See how a home solar system works in 3D. Drag to rotate, scroll to
            zoom, click any part to learn what it does, and run a day to watch
            energy flow from the sun to your home, battery, and the grid.
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

      {/* Stage */}
      <div className="relative rounded-2xl bg-gradient-to-br from-primary/25 via-border to-chart-3/20 p-px shadow-xl">
        <div className="relative h-[62vh] min-h-[440px] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-sky-200 via-sky-100 to-accent sm:h-[68vh] md:max-h-[700px]">
          <SolarScene3D
            frame={frame}
            panelCount={snapshot.panelCount}
            hasBattery={snapshot.hasBattery}
            selected={selected}
            onSelect={setSelected}
            preset={preset}
            resetKey={resetKey}
            reducedMotion={reducedMotion}
          />

          {/* Overlays (non-interactive container; children opt back in) */}
          <div className="pointer-events-none absolute inset-0 p-3 sm:p-4">
            {/* Live stats */}
            <div className="pointer-events-auto absolute left-3 top-3 w-48 overflow-hidden rounded-xl border border-white/50 bg-card/80 shadow-lg ring-1 ring-black/5 backdrop-blur-md sm:left-4 sm:top-4 sm:w-56">
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
              <div className="pointer-events-auto absolute right-3 top-3 w-56 overflow-hidden rounded-xl border border-white/50 bg-card/80 shadow-lg ring-1 ring-black/5 backdrop-blur-md sm:right-4 sm:top-4">
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
                          ? // A >100% offset earns more in export credit than the
                            // bill costs, so the net is money back.
                            `${money(-snapshot.billWithSolar)} credit`
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
                  {snapshot.panelCount}-panel, {snapshot.systemSizeKw.toFixed(1)}{" "}
                  kW system.
                </p>
              </div>
            ) : null}

            {/* Legend */}
            <div className="pointer-events-auto absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1.5 rounded-xl border border-white/50 bg-card/80 px-3 py-2 shadow-lg ring-1 ring-black/5 backdrop-blur-md sm:bottom-4 sm:left-4">
              {LEGEND.map((item) => {
                const active =
                  frame.flows[item.key as keyof typeof frame.flows] > 0.05
                return (
                  <span
                    key={item.key}
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] font-medium transition-opacity duration-300",
                      active ? "opacity-100" : "opacity-30",
                    )}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: active
                          ? `0 0 6px ${item.color}`
                          : "none",
                      }}
                      aria-hidden="true"
                    />
                    {item.label}
                  </span>
                )
              })}
            </div>

            {/* Hint */}
            <div className="pointer-events-none absolute bottom-3 right-3 hidden rounded-lg border border-white/40 bg-card/70 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md sm:block">
              Drag to rotate · scroll to zoom · click a part
            </div>
          </div>
        </div>
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
            onClick={() => setPreset("flow")}
            active={preset === "flow"}
          >
            <Route className="size-4" aria-hidden="true" />
            Energy flow
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
            Reset view
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
            {/* Position marker under the thumb */}
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
          margin-top: 0;
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
      `}</style>
    </section>
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
            : "border-input bg-background text-muted-foreground hover:border-ring hover:text-foreground hover:shadow-sm",
      )}
    >
      {children}
    </button>
  )
}

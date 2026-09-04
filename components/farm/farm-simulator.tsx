"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Droplets,
  Info,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Sprout,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  computeMetrics,
  CROP_BY_ID,
  CROP_ORDER,
  DIVERSIFIED_MIX,
  mixFromDiversity,
  RISK_COLORS,
  seasonPhase,
  SEASON_ANCHORS,
  SEASON_LABELS,
  SEASON_ORDER,
  TOTAL_ACRES,
  usd,
  usdCompact,
  type CropId,
  type SeasonPhase,
} from "@/lib/farm-sim"

// One clay render per season, crossfaded across the timeline in order.
const SEASON_SRC = {
  spring: "/farm-styles/slab-spring.png",
  summer: "/farm-styles/option-b-slab.png",
  fall: "/farm-styles/slab-harvest.png",
  winter: "/farm-styles/slab-winter.png",
} as const


/* ------------------------------------------------------------------ *
 * Reduced motion
 * ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ *
 * Clickable clay hotspots positioned over the diorama render
 * ------------------------------------------------------------------ */
type SpotId = "fields" | "barn" | "silos" | "pond" | "farmhouse"

type Spot = {
  id: SpotId
  label: string
  x: number
  y: number
}

// x values are the horizontal position across the square render (0–100%).
const SPOTS: Spot[] = [
  { id: "fields", label: "Crop fields", x: 23.3, y: 58 },
  { id: "farmhouse", label: "Farmstead", x: 43.3, y: 50 },
  { id: "barn", label: "Barn & equipment", x: 67.3, y: 41 },
  { id: "silos", label: "Grain storage", x: 82, y: 31 },
  { id: "pond", label: "Irrigation pond", x: 47.3, y: 71 },
]

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */
export function FarmSimulator() {
  const reducedMotion = useReducedMotion()

  // Season runs 0 (early spring) → 1 (late-fall harvest). The manual slider
  // snaps to the four season anchors, but the value stays a float so auto-play
  // and the sun arc can still animate smoothly. Defaults to spring.
  const [season, setSeason] = useState(SEASON_ANCHORS.spring)
  const [playing, setPlaying] = useState(false)
  // Crop diversity: 0 = single crop (all corn), 1 = fully diversified.
  const [diversity, setDiversity] = useState(1)
  const [selected, setSelected] = useState<SpotId | null>(null)

  const mix = useMemo(() => mixFromDiversity(diversity), [diversity])
  const metrics = useMemo(() => computeMetrics(mix), [mix])
  const phase = seasonPhase(season)
  // Which of the four season stops the slider thumb sits on.
  const seasonIndex = SEASON_ORDER.indexOf(phase)

  // Auto-advance the season when playing.
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (!playing || reducedMotion) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setSeason((s) => {
        const next = s + dt * 0.16
        if (next >= 1) {
          setPlaying(false)
          return 1
        }
        return next
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [playing, reducedMotion])

  const handleReset = () => {
    setPlaying(false)
    setSeason(SEASON_ANCHORS.spring)
    setDiversity(1)
    setSelected(null)
  }

  // Season → 4-image crossfade. Find the two season renders bracketing the
  // slider value and blend between them; everything else stays hidden. Because
  // the images are stacked in season order (spring first, winter last), the
  // painter's algorithm keeps the fully-opaque earlier season beneath the
  // fading-in later one for a clean transition.
  const seasonOpacity = useMemo(() => {
    const anchors = SEASON_ORDER.map((s) => SEASON_ANCHORS[s])
    let seg = 0
    for (let i = 0; i < anchors.length - 1; i++) {
      if (season >= anchors[i]) seg = i
    }
    const span = anchors[seg + 1] - anchors[seg]
    const f = span > 0 ? Math.max(0, Math.min(1, (season - anchors[seg]) / span)) : 0
    return SEASON_ORDER.map((_, i) => (i === seg ? 1 : i === seg + 1 ? f : 0))
  }, [season])

  // Sun arc position across the top of the stage.
  const sunLeft = 2 + season * 96
  const sunTop = 26 - Math.sin(season * Math.PI) * 18

  return (
    <section
      aria-label="Interactive Farm Simulator"
      className="flex flex-col gap-4"
    >
      {/* Heading */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sprout className="size-4" aria-hidden="true" />
          </span>
          <h3 className="text-lg font-semibold text-foreground">
            Interactive Farm Simulator
          </h3>
        </div>
        <p className="text-pretty text-sm text-muted-foreground">
          Watch a clay farm move through the season and see how a diversified
          planting changes the money, water and risk. Illustrative
          whole-farm estimates, not local advice.
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-2">
        {/* Controls form a left sidebar on desktop (stacked in a single
            column). On tablet they lay out as a row of three below the visual;
            on mobile they stack. `order-last` drops them under the stage until
            the desktop row re-forms them beside it. */}
        <div className="order-last grid gap-3 md:grid-cols-3 lg:order-none lg:w-72 lg:shrink-0 lg:grid-cols-1">
          <div className="order-2 h-full rounded-2xl border border-border bg-card p-3 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              This season
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Metric
                icon={<TrendingUp className="size-3.5" aria-hidden="true" />}
                label="Profit"
                value={usdCompact(metrics.profit)}
                accent
              />
              <Metric
                icon={<Wallet className="size-3.5" aria-hidden="true" />}
                label="Revenue"
                value={usdCompact(metrics.revenue)}
              />
              <Metric
                icon={<Droplets className="size-3.5" aria-hidden="true" />}
                label="Water"
                value={`${metrics.waterMGal.toFixed(1)}M gal`}
              />
              <Metric
                label="Risk"
                value={metrics.risk}
                valueColor={RISK_COLORS[metrics.risk]}
              />
            </div>
          </div>

          {/* Season control — placed first so it sits above "This season" on
              mobile and to its left on desktop. */}
          <div className="order-1 h-full rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Season
              </span>
              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                {SEASON_LABELS[phase]}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={seasonIndex}
              onChange={(e) => {
                setPlaying(false)
                const idx = Number.parseInt(e.target.value, 10)
                setSeason(SEASON_ANCHORS[SEASON_ORDER[idx]])
              }}
              className="farm-season-slider h-2.5 w-full cursor-pointer appearance-none rounded-full"
              aria-label="Season"
              aria-valuetext={SEASON_LABELS[phase]}
              style={{
                background:
                  "linear-gradient(90deg, #8bbf6a 0% 25%, #4f7a37 25% 50%, #d8b64a 50% 75%, #cdd7de 75% 100%)",
              }}
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Spring</span>
              <span>Summer</span>
              <span>Fall</span>
              <span>Winter</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <PillButton
                onClick={() => setPlaying((p) => !p)}
                disabled={reducedMotion}
                active={playing}
                primary
                title={
                  reducedMotion
                    ? "Auto-play is off because your system prefers reduced motion."
                    : undefined
                }
              >
                {playing ? (
                  <Pause className="size-4" aria-hidden="true" />
                ) : (
                  <Play className="size-4" aria-hidden="true" />
                )}
                {playing ? "Pause" : "Run year"}
              </PillButton>
              <PillButton
                onClick={() => {
                  setPlaying(false)
                  setSeason(SEASON_ANCHORS.fall)
                }}
              >
                <Scissors className="size-4" aria-hidden="true" />
                Harvest
              </PillButton>
              <PillButton onClick={handleReset}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset
              </PillButton>
            </div>
          </div>

          {/* Crop diversity */}
          <div className="order-3 h-full rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-foreground">
                Crop diversity
              </span>
              <span className="text-xs text-muted-foreground">
                Slide from a single cash crop toward a diversified mix across the
                {" "}
                {TOTAL_ACRES}-acre farm.
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Single</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={diversity}
                onChange={(e) => setDiversity(Number.parseFloat(e.target.value))}
                className="farm-diversity-slider h-2.5 flex-1 cursor-pointer appearance-none rounded-full"
                aria-label="Crop diversity"
              />
              <span className="text-xs text-muted-foreground">Diverse</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {CROP_ORDER.map((id) => {
                const crop = CROP_BY_ID[id]
                const acres = mix[id]
                const active = acres > 0
                return (
                  <div
                    key={id}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium transition-opacity",
                      active
                        ? "border-border bg-background text-foreground"
                        : "border-dashed border-border/60 bg-muted/40 text-muted-foreground opacity-70",
                    )}
                  >
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ background: crop.accent }}
                      aria-hidden="true"
                    />
                    {crop.name}
                    <span className="tabular-nums text-muted-foreground">
                      {acres} ac
                    </span>
                  </div>
                )
              })}
              {metrics.fallowAcres > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-dashed border-border/60 bg-muted/40 px-2 py-1 text-[11px] font-medium text-muted-foreground">
                  <span
                    className="inline-block size-2.5 rounded-full bg-[#c2a173]"
                    aria-hidden="true"
                  />
                  Fallow
                  <span className="tabular-nums">{metrics.fallowAcres} ac</span>
                </div>
              )}
            </div>

            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              Prototype figures for illustrating trade-offs. For a real plan, use
              the crop selection tool and profitability calculator below.
            </p>
          </div>
        </div>

        {/* Clay diorama stage — a square panel like the landscape/solar
            explorers. The render is a square image, so an aspect-square panel
            lets it fill edge-to-edge with no letterbox and therefore no side
            edge line. `order-1` keeps it above the controls on mobile; on
            desktop it becomes the right column beside the control sidebar. */}
        <div className="order-1 flex flex-1 justify-center lg:order-none">
          <div className="relative aspect-square w-full max-w-2xl overflow-hidden rounded-3xl border border-[#e4d9c2] bg-[#f2e9d7]">
            <div className="absolute inset-0">
            {/* Sun */}
            {!reducedMotion && (
              <div
                className="pointer-events-none absolute size-14 rounded-full blur-[1px] transition-all duration-300"
                style={{
                  left: `${sunLeft}%`,
                  top: `${sunTop}%`,
                  transform: "translate(-50%, -50%)",
                  background:
                    "radial-gradient(circle, rgba(255,224,150,0.95) 0%, rgba(255,214,120,0.35) 60%, rgba(255,214,120,0) 75%)",
                }}
                aria-hidden="true"
              />
            )}

            {/* Floating shadow */}
            <div
              className="pointer-events-none absolute left-1/2 bottom-[12%] h-[9%] w-[62%] -translate-x-1/2 rounded-[50%] bg-black/20 blur-xl"
              aria-hidden="true"
            />

            {/* Diorama images — one clay render per season, crossfaded in order */}
            <div className="absolute inset-0">
              {SEASON_ORDER.map((s, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={s}
                  src={SEASON_SRC[s] || "/placeholder.svg"}
                  alt={i === 0 ? "Clay model farm through the seasons" : ""}
                  aria-hidden={i === 0 ? undefined : true}
                  className="absolute inset-0 size-full object-contain transition-opacity duration-300"
                  style={{
                    opacity: seasonOpacity[i],
                    filter: "drop-shadow(0 22px 26px rgba(90,60,25,0.28))",
                  }}
                  crossOrigin="anonymous"
                />
              ))}
            </div>

            {/* Hotspots */}
            {SPOTS.map((spot) => {
              const isSel = selected === spot.id
              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => setSelected(isSel ? null : spot.id)}
                  aria-label={spot.label}
                  aria-pressed={isSel}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 outline-none"
                  style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                >
                  <span className="relative flex size-5 items-center justify-center">
                    {!reducedMotion && (
                      <span
                        className={cn(
                          "absolute inline-flex size-full rounded-full",
                          isSel ? "bg-primary/40" : "bg-primary/25 animate-ping",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "relative inline-flex size-3.5 rounded-full border-2 border-white shadow-md transition-transform group-hover:scale-125 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                        isSel ? "scale-125 bg-primary" : "bg-primary/90",
                      )}
                    />
                  </span>
                </button>
              )
            })}

            {/* Selected card */}
            {selected && (
              <SpotCard
                spot={SPOTS.find((s) => s.id === selected)!}
                mix={mix}
                metrics={metrics}
                onClose={() => setSelected(null)}
              />
            )}

            {/* Season badge */}
            <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/50 bg-card/85 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-md">
              {`${SEASON_LABELS[phase]} on the farm`}
            </div>

            {/* Hint */}
            <div className="pointer-events-none absolute bottom-3 right-3 hidden rounded-lg border border-white/40 bg-card/75 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-md sm:block">
              Tap a marker to learn more
            </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .farm-season-slider::-webkit-slider-thumb,
        .farm-diversity-slider::-webkit-slider-thumb {
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
        .farm-season-slider::-moz-range-thumb,
        .farm-diversity-slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid var(--primary);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
          cursor: pointer;
        }
        .farm-diversity-slider {
          background: linear-gradient(90deg, #5f7a34 0%, #7f9f4a 50%, #2f6b3f 100%);
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
  valueColor,
}: {
  icon?: React.ReactNode
  label: string
  value: string
  accent?: boolean
  valueColor?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 rounded-xl border p-2",
        accent ? "border-primary/30 bg-primary/5" : "border-border bg-background",
      )}
    >
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <span
        className="text-sm font-semibold tabular-nums text-foreground"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Pill button
 * ------------------------------------------------------------------ */
function PillButton({
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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-45",
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

/* ------------------------------------------------------------------ *
 * Floating info card for a selected hotspot
 * ------------------------------------------------------------------ */
function SpotCard({
  spot,
  mix,
  metrics,
  onClose,
}: {
  spot: Spot
  mix: ReturnType<typeof mixFromDiversity>
  metrics: ReturnType<typeof computeMetrics>
  onClose: () => void
}) {
  const content = spotContent(spot.id, mix, metrics)
  // Keep the card inside the stage: flip to the left when the pin is on the right.
  const flip = spot.x > 55
  return (
    <div
      className="absolute z-10 w-56 -translate-y-1/2 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md"
      style={{
        top: `${Math.min(78, Math.max(24, spot.y))}%`,
        left: flip ? undefined : `${Math.min(spot.x + 6, 52)}%`,
        right: flip ? `${Math.min(100 - spot.x + 6, 52)}%` : undefined,
      }}
      role="dialog"
      aria-label={content.title}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{content.title}</h4>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <p className="mt-0.5 text-xs font-medium text-primary">{content.stat}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
        {content.blurb}
      </p>
    </div>
  )
}

function spotContent(
  id: SpotId,
  mix: ReturnType<typeof mixFromDiversity>,
  metrics: ReturnType<typeof computeMetrics>,
): { title: string; stat: string; blurb: string } {
  switch (id) {
    case "fields": {
      const planted = CROP_ORDER.filter((c) => mix[c] > 0).length
      return {
        title: "Crop fields",
        stat: `${metrics.plantedAcres} acres planted · ${planted} crop${planted === 1 ? "" : "s"}`,
        blurb:
          "Each field block is painted with a crop from your mix. Spreading acreage across crops lowers the odds that one bad market or pest wipes out the season.",
      }
    }
    case "farmhouse":
      return {
        title: "Farmstead",
        stat: `${metrics.concentration}% crop concentration`,
        blurb:
          "The heart of the operation. A lower concentration number means your income leans on more than one crop — steadier, if a little more work to manage.",
      }
    case "barn":
      return {
        title: "Barn & equipment",
        stat: `${usd(metrics.cost)} operating cost`,
        blurb:
          "Machinery, seed and inputs live here. Diversified farms share equipment across crops but juggle more planting and harvest windows.",
      }
    case "silos":
      return {
        title: "Grain storage",
        stat: `${usdCompact(metrics.revenue)} projected revenue`,
        blurb:
          "On-farm storage lets you hold grain for a better price instead of selling at harvest lows — a key lever on whole-farm revenue.",
      }
    case "pond":
      return {
        title: "Irrigation pond",
        stat: `${metrics.waterMGal.toFixed(1)}M gallons / season`,
        blurb:
          "Water demand shifts with your mix. Thirstier crops raise the seasonal draw; matching crops to your water budget keeps the pond ahead of the fields.",
      }
  }
}

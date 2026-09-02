"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRight,
  Droplets,
  Leaf,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Sprout,
  Sun,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  allocateFields,
  computeMetrics,
  CROP_BY_ID,
  CROP_ORDER,
  CROPS,
  DIVERSIFIED_MIX,
  FALLOW_CLAY,
  FIELD_PLOTS,
  RISK_COLORS,
  SEASON_ANCHORS,
  SEASON_LABELS,
  TOTAL_ACRES,
  emptyMix,
  fallowAcres,
  mixFromDiversity,
  mixTotal,
  seasonPhase,
  usd,
  usdCompact,
  type CropId,
  type CropMix,
  type SeasonPhase,
} from "@/lib/farm-sim"

/* ------------------------------------------------------------------ *
 * Color helpers
 * ------------------------------------------------------------------ */
function hexToRgb(hex: string) {
  const h = hex.replace("#", "")
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function hexLerp(a: string, b: string, t: number) {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const r = Math.round(lerp(ca.r, cb.r, t))
  const g = Math.round(lerp(ca.g, cb.g, t))
  const bl = Math.round(lerp(ca.b, cb.b, t))
  return `rgb(${r}, ${g}, ${bl})`
}
function shade(hex: string, amt: number) {
  const c = hexToRgb(hex)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)))
  return `rgb(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`
}

/* ------------------------------------------------------------------ *
 * Season → crop appearance
 * ------------------------------------------------------------------ */
type CropVisual = {
  fill: string
  rowColor: string
  /** 0–1 canopy fullness, scales row height + shadow. */
  fullness: number
  harvested: boolean
}

function cropVisual(cropId: CropId, season: number, harvested: boolean): CropVisual {
  const crop = CROP_BY_ID[cropId]
  const k = crop.clay
  if (harvested || season >= 0.985) {
    return { fill: k.harvest, rowColor: shade(k.harvest, -22), fullness: 0.12, harvested: true }
  }
  const phase = seasonPhase(season)
  if (phase === "spring") {
    const p = Math.min(1, season / 0.37)
    return {
      fill: hexLerp(k.soil, k.sprout, p),
      rowColor: shade(k.sprout, -18),
      fullness: 0.12 + 0.28 * p,
      harvested: false,
    }
  }
  if (phase === "summer") {
    const p = Math.min(1, (season - 0.37) / 0.33)
    return {
      fill: hexLerp(k.sprout, k.lush, p),
      rowColor: shade(k.lush, -20),
      fullness: 0.4 + 0.45 * p,
      harvested: false,
    }
  }
  // fall
  const p = Math.min(1, (season - 0.7) / 0.3)
  const matureBlend = Math.min(1, p * 1.25)
  return {
    fill: hexLerp(k.lush, k.mature, matureBlend),
    rowColor: shade(k.mature, -20),
    fullness: 0.85 + 0.1 * (1 - p), // slight settle as it dries
    harvested: false,
  }
}

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
 * Derive a diversity-slider position from a mix (inverse of the preset blend)
 * ------------------------------------------------------------------ */
function diversityFromMix(mix: CropMix): number {
  const planted = mixTotal(mix)
  if (planted === 0) return 1
  let hhi = 0
  for (const id of CROP_ORDER) {
    const s = mix[id] / planted
    hhi += s * s
  }
  // HHI 1 (single) → 0, HHI ~0.285 (diversified preset) → 1
  const t = (1 - hhi) / (1 - 0.285)
  return Math.max(0, Math.min(1, t))
}

/* ================================================================== *
 * Main component
 * ================================================================== */
export function FarmSimulator() {
  const [mix, setMix] = useState<CropMix>(() => ({ ...emptyMix() }))
  const [season, setSeason] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [harvested, setHarvested] = useState(false)
  const [activeCrop, setActiveCrop] = useState<CropId | null>(null)
  const reducedMotion = useReducedMotion()
  const stageRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  const metrics = useMemo(() => computeMetrics(mix), [mix])
  const allocation = useMemo(() => allocateFields(mix), [mix])
  const phase = seasonPhase(season)
  const diversity = useMemo(() => diversityFromMix(mix), [mix])

  // Season auto-play: advance to the end of the season, then stop.
  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setSeason((s) => {
        const next = s + dt / 7 // ~7s for a full season
        if (next >= 1) {
          setPlaying(false)
          return 1
        }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing])

  // Reaching the very end of fall auto-marks the harvest.
  useEffect(() => {
    if (season >= 0.985 && metrics.plantedAcres > 0) setHarvested(true)
  }, [season, metrics.plantedAcres])

  const setCropAcres = useCallback((id: CropId, value: number) => {
    setMix((prev) => {
      const others = CROP_ORDER.reduce(
        (sum, c) => (c === id ? sum : sum + prev[c]),
        0,
      )
      const capped = Math.max(0, Math.min(value, TOTAL_ACRES - others))
      return { ...prev, [id]: capped }
    })
    setHarvested(false)
  }, [])

  const setDiversity = useCallback((t: number) => {
    setMix(mixFromDiversity(t))
    setHarvested(false)
  }, [])

  const scrollToStage = () =>
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })

  const startPlanting = () => {
    if (mixTotal(mix) === 0) setMix({ ...DIVERSIFIED_MIX })
    scrollToStage()
  }

  const playSeason = () => {
    if (reducedMotion) return
    if (season >= 1) {
      setSeason(0)
      setHarvested(false)
    }
    setPlaying((p) => !p)
  }

  const reset = () => {
    setPlaying(false)
    setSeason(0)
    setHarvested(false)
    setMix({ ...emptyMix() })
    setActiveCrop(null)
  }

  const activeCropData = activeCrop ? CROP_BY_ID[activeCrop] : null

  return (
    <section aria-label="Interactive Farm Simulator" className="flex flex-col gap-8">
      {/* Hero */}
      <header className="flex flex-col gap-4">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Farm Simulator
        </span>
        <h2 className="max-w-2xl text-balance font-serif text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          Plant your farm. Watch the season unfold.
        </h2>
        <p className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
          Explore crop mixes, water use, harvests, and projected profitability in
          an interactive miniature farm.
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startPlanting}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start planting
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
          <a
            href="#agriculture-calculators"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Optimize my farm
          </a>
        </div>
      </header>

      {/* Simulator row: metrics panel + clay farm */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
        <MetricsPanel metrics={metrics} mix={mix} onFocusCrop={setActiveCrop} />

        <div className="flex flex-1 flex-col gap-3">
          <div
            ref={stageRef}
            className="relative mx-auto aspect-square w-full max-w-2xl overflow-hidden rounded-[2rem] scroll-mt-24"
            style={{
              background:
                "radial-gradient(120% 110% at 30% 0%, #f7f1e6 0%, #eee4d2 55%, #e5d9c3 100%)",
              boxShadow: "inset 0 2px 30px rgba(120,95,60,0.12)",
            }}
          >
            <ClayFarm
              allocation={allocation}
              season={season}
              phase={phase}
              harvested={harvested}
              activeCrop={activeCrop}
              reducedMotion={reducedMotion}
              onSelectCrop={(id) =>
                setActiveCrop((cur) => (cur === id ? null : id))
              }
            />

            {activeCropData ? (
              <CropCard
                crop={activeCropData}
                acres={mix[activeCropData.id]}
                onClose={() => setActiveCrop(null)}
              />
            ) : (
              <p className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 rounded-full border border-border/60 bg-card/80 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm sm:block">
                Tap a field to inspect a crop
              </p>
            )}

            {/* Season badge */}
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-border/60 bg-card/85 px-3 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur-sm">
              <PhaseIcon phase={phase} />
              {SEASON_LABELS[phase]}
            </div>
          </div>

          {/* Season simulator */}
          <SeasonControls
            season={season}
            phase={phase}
            playing={playing}
            harvested={harvested}
            canHarvest={phase === "fall" && metrics.plantedAcres > 0}
            reducedMotion={reducedMotion}
            onScrub={(v) => {
              setPlaying(false)
              setSeason(v)
              if (v < 0.985) setHarvested(false)
            }}
            onPlay={playSeason}
            onJump={(p) => {
              setPlaying(false)
              setSeason(SEASON_ANCHORS[p])
              if (p !== "fall") setHarvested(false)
            }}
            onHarvest={() => {
              setPlaying(false)
              setSeason(1)
              setHarvested(true)
            }}
            onReset={reset}
          />
        </div>
      </div>

      {/* Allocation controls */}
      <div className="grid gap-5 lg:grid-cols-2">
        <CropMixControl mix={mix} onChange={setCropAcres} />
        <DiversityControl
          diversity={diversity}
          concentration={metrics.concentration}
          risk={metrics.risk}
          onChange={setDiversity}
        />
      </div>
    </section>
  )
}

/* ================================================================== *
 * Clay farm model
 * ================================================================== */
function ClayFarm({
  allocation,
  season,
  phase,
  harvested,
  activeCrop,
  reducedMotion,
  onSelectCrop,
}: {
  allocation: Record<string, CropId | null>
  season: number
  phase: SeasonPhase
  harvested: boolean
  activeCrop: CropId | null
  reducedMotion: boolean
  onSelectCrop: (id: CropId) => void
}) {
  // Reservoir draws down through summer, refills a little by fall.
  const reservoirLevel =
    phase === "spring"
      ? 0.9
      : phase === "summer"
        ? 0.9 - 0.5 * Math.min(1, (season - 0.37) / 0.33)
        : 0.5 + 0.15 * Math.min(1, (season - 0.7) / 0.3)
  const irrigating = phase === "summer"

  return (
    <div className="absolute inset-0">
      {/* Soft ground shadow */}
      <span className="absolute inset-x-[8%] bottom-[4%] h-8 rounded-[50%] bg-[rgba(120,90,55,0.18)] blur-xl" />

      {/* Base farm plane */}
      <div
        className="absolute rounded-[1.8rem]"
        style={{
          left: "5%",
          right: "5%",
          top: "6%",
          bottom: "5%",
          background: "linear-gradient(160deg, #e7dabd 0%, #dccaa6 100%)",
          boxShadow:
            "0 22px 40px rgba(110,80,50,0.22), inset 0 3px 5px rgba(255,255,255,0.5)",
        }}
      />

      {/* Windbreak trees along the top-left edge */}
      {[
        { x: 8, y: 12 },
        { x: 15, y: 9 },
        { x: 22, y: 11 },
        { x: 29, y: 9 },
      ].map((t, i) => (
        <ClayTree key={i} x={t.x} y={t.y} />
      ))}

      {/* Farm road: a soft curved lane from the farmstead down between fields */}
      <div
        className="absolute"
        style={{
          left: "31%",
          top: "16%",
          width: "9%",
          height: "80%",
          background: "linear-gradient(90deg, #cdbb98, #d9cab9)",
          borderRadius: "40% 40% 20% 20%",
          transform: "rotate(2deg)",
          boxShadow: "inset 0 2px 4px rgba(120,95,60,0.2)",
          opacity: 0.9,
        }}
      />

      {/* Farmstead cluster, upper-left */}
      <Farmhouse />
      <Barn />
      <Silo x={20} y={30} />
      <Silo x={25} y={31} small />
      <Greenhouse />

      {/* Water reservoir, lower-left */}
      <Reservoir level={reservoirLevel} />

      {/* Tractor: parked by the fields in spring, returns for fall harvest */}
      <Tractor
        visible={phase !== "summer"}
        harvesting={phase === "fall"}
        reducedMotion={reducedMotion}
      />

      {/* Fields */}
      {FIELD_PLOTS.map((plot) => {
        const cropId = allocation[plot.id]
        return (
          <FieldTile
            key={plot.id}
            plot={plot}
            cropId={cropId}
            season={season}
            harvested={harvested}
            active={cropId !== null && cropId === activeCrop}
            dim={activeCrop !== null && cropId !== activeCrop}
            irrigating={irrigating}
            reducedMotion={reducedMotion}
            onSelect={() => cropId && onSelectCrop(cropId)}
          />
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Field tile
 * ------------------------------------------------------------------ */
function FieldTile({
  plot,
  cropId,
  season,
  harvested,
  active,
  dim,
  irrigating,
  reducedMotion,
  onSelect,
}: {
  plot: (typeof FIELD_PLOTS)[number]
  cropId: CropId | null
  season: number
  harvested: boolean
  active: boolean
  dim: boolean
  irrigating: boolean
  reducedMotion: boolean
  onSelect: () => void
}) {
  const vis = cropId ? cropVisual(cropId, season, harvested) : null
  const fill = vis ? vis.fill : FALLOW_CLAY.soil
  const rowColor = vis ? vis.rowColor : shade(FALLOW_CLAY.soil, -14)
  const fullness = vis ? vis.fullness : 0.08

  // Row stripes rendered as a repeating gradient; band width grows with canopy.
  const band = 2 + Math.round(fullness * 4)
  const gap = 7
  const rowOverlay =
    fullness > 0.05
      ? `repeating-linear-gradient(84deg, ${rowColor} 0 ${band}px, transparent ${band}px ${gap}px)`
      : "none"

  const Tag = cropId ? "button" : "div"
  const interactiveProps = cropId
    ? {
        type: "button" as const,
        onClick: onSelect,
        "aria-label": `${CROP_BY_ID[cropId].name} field`,
        "aria-pressed": active,
      }
    : { "aria-hidden": true as const }

  return (
    <Tag
      {...(interactiveProps as Record<string, unknown>)}
      className={cn(
        "absolute overflow-hidden outline-none transition-[opacity,transform] duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        cropId && "cursor-pointer",
        dim ? "opacity-45" : "opacity-100",
        active && "z-10 scale-[1.03]",
      )}
      style={{
        left: `${plot.x}%`,
        top: `${plot.y}%`,
        width: `${plot.w}%`,
        height: `${plot.h}%`,
        borderRadius: plot.radius,
        transform: `rotate(${plot.tilt}deg)`,
        background: `linear-gradient(160deg, ${fill} 0%, ${shade(fill, -16)} 100%)`,
        boxShadow: active
          ? "0 10px 20px rgba(80,90,40,0.3), inset 0 2px 4px rgba(255,255,255,0.4)"
          : "0 5px 10px rgba(100,85,50,0.18), inset 0 2px 4px rgba(255,255,255,0.35), inset 0 -3px 6px rgba(90,70,45,0.16)",
        transitionProperty: "opacity, transform, background, box-shadow",
      }}
    >
      {/* Crop rows */}
      <span
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          background: rowOverlay,
          opacity: vis ? 0.55 + fullness * 0.35 : 0,
        }}
      />
      {/* Canopy top-light to fake height in taller crops */}
      {vis && fullness > 0.5 ? (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.22), transparent)",
          }}
        />
      ) : null}
      {/* Irrigation shimmer in summer */}
      {irrigating && vis && !reducedMotion ? (
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full"
          style={{ background: "rgba(120,170,210,0.7)" }}
        />
      ) : null}
    </Tag>
  )
}

/* ------------------------------------------------------------------ *
 * Clay props
 * ------------------------------------------------------------------ */
function Farmhouse() {
  return (
    <div className="absolute" style={{ left: "6%", top: "20%", width: "13%", height: "13%" }}>
      <div
        className="absolute inset-x-0 bottom-0 h-2/3 rounded-md"
        style={{
          background: "linear-gradient(160deg, #efe3cd, #e2d1b1)",
          boxShadow: "0 4px 8px rgba(110,80,50,0.25), inset 0 2px 3px rgba(255,255,255,0.5)",
        }}
      />
      <div
        className="absolute inset-x-[-6%] top-0 h-2/5 rounded-t-md"
        style={{
          background: "linear-gradient(160deg, #cf8055, #b1663f)",
          clipPath: "polygon(12% 100%, 50% 0, 88% 100%)",
        }}
      />
    </div>
  )
}

function Barn() {
  return (
    <div className="absolute" style={{ left: "20%", top: "19%", width: "10%", height: "11%" }}>
      <div
        className="absolute inset-x-0 bottom-0 h-3/5 rounded-sm"
        style={{
          background: "linear-gradient(160deg, #c1553f, #a5442f)",
          boxShadow: "0 4px 8px rgba(110,60,40,0.28), inset 0 2px 3px rgba(255,255,255,0.25)",
        }}
      />
      <div
        className="absolute inset-x-[-8%] top-0 h-3/5 rounded-t-md"
        style={{
          background: "linear-gradient(160deg, #8f3f2d, #7a3526)",
          clipPath: "polygon(0 100%, 50% 10%, 100% 100%)",
        }}
      />
      <span className="absolute bottom-0 left-1/2 h-1/2 w-1/4 -translate-x-1/2 rounded-t-sm bg-[rgba(90,45,30,0.7)]" />
    </div>
  )
}

function Silo({ x, y, small }: { x: number; y: number; small?: boolean }) {
  const w = small ? 3.2 : 4
  const h = small ? 9 : 12
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}>
      <div
        className="absolute inset-x-0 bottom-0 h-[85%] rounded-t-md"
        style={{
          background: "linear-gradient(90deg, #cdd0cf 0%, #eef0ef 45%, #c4c7c6 100%)",
          boxShadow: "0 4px 8px rgba(90,90,90,0.25)",
        }}
      />
      <div
        className="absolute inset-x-[-8%] top-0 h-1/4 rounded-t-full"
        style={{ background: "linear-gradient(160deg, #b7bbba, #9aa09e)" }}
      />
    </div>
  )
}

function Greenhouse() {
  return (
    <div
      className="absolute"
      style={{ left: "7%", top: "34%", width: "12%", height: "7%" }}
    >
      <div
        className="size-full overflow-hidden rounded-md"
        style={{
          background: "linear-gradient(160deg, rgba(180,214,205,0.9), rgba(150,193,182,0.9))",
          boxShadow: "0 4px 7px rgba(90,110,100,0.22), inset 0 2px 3px rgba(255,255,255,0.6)",
        }}
      >
        <span className="absolute inset-y-0 left-1/3 w-px bg-[rgba(255,255,255,0.6)]" />
        <span className="absolute inset-y-0 left-2/3 w-px bg-[rgba(255,255,255,0.6)]" />
      </div>
    </div>
  )
}

function Reservoir({ level }: { level: number }) {
  const clamped = Math.max(0.15, Math.min(1, level))
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: "8%",
        top: "62%",
        width: "16%",
        height: "16%",
        borderRadius: "48% 44% 46% 50%",
        background: "linear-gradient(160deg, #9c8a63, #85744f)",
        boxShadow: "inset 0 3px 8px rgba(70,55,35,0.4)",
        transform: "rotate(-4deg)",
      }}
    >
      <div
        className="absolute inset-x-[6%] bottom-[6%] transition-[height] duration-700"
        style={{
          height: `${clamped * 82}%`,
          borderRadius: "44% 44% 46% 48%",
          background: "linear-gradient(160deg, #7fb4d6 0%, #5c93bd 100%)",
          boxShadow: "inset 0 2px 4px rgba(255,255,255,0.4)",
        }}
      >
        <span className="absolute inset-x-2 top-1 h-1 rounded-full bg-[rgba(255,255,255,0.5)]" />
      </div>
    </div>
  )
}

function ClayTree({ x, y }: { x: number; y: number }) {
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, width: "6%", height: "9%" }}>
      <span
        className="absolute bottom-0 left-1/2 h-1/3 w-[18%] -translate-x-1/2 rounded-sm"
        style={{ background: "linear-gradient(90deg, #8a6a45, #6f5334)" }}
      />
      <span
        className="absolute left-1/2 top-0 h-3/4 w-full -translate-x-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle at 40% 35%, #6f9550, #3f6a37)",
          boxShadow: "0 4px 7px rgba(60,90,50,0.3), inset 0 2px 3px rgba(255,255,255,0.3)",
        }}
      />
    </div>
  )
}

function Tractor({
  visible,
  harvesting,
  reducedMotion,
}: {
  visible: boolean
  harvesting: boolean
  reducedMotion: boolean
}) {
  return (
    <div
      className="absolute transition-all duration-700"
      style={{
        left: harvesting ? "60%" : "34%",
        top: harvesting ? "60%" : "40%",
        width: "8%",
        height: "6%",
        opacity: visible ? 1 : 0,
        transform: `scale(${visible ? 1 : 0.7})`,
      }}
      aria-hidden="true"
    >
      {/* body */}
      <span
        className="absolute bottom-0 left-0 h-[55%] w-3/4 rounded-sm"
        style={{
          background: "linear-gradient(160deg, #d06a3a, #b4552b)",
          boxShadow: "0 3px 5px rgba(110,60,35,0.3)",
        }}
      />
      {/* cab */}
      <span
        className="absolute left-[8%] top-0 h-[55%] w-[38%] rounded-sm"
        style={{ background: "linear-gradient(160deg, #e0954f, #c47a38)" }}
      />
      {/* big rear wheel */}
      <span className="absolute -bottom-[6%] left-[2%] size-[42%] rounded-full border-[3px] border-[#3a2c1f] bg-[#59422e]" />
      {/* small front wheel */}
      <span className="absolute bottom-0 right-[6%] size-[28%] rounded-full border-2 border-[#3a2c1f] bg-[#59422e]" />
      {/* exhaust puff during harvest */}
      {harvesting && !reducedMotion ? (
        <span className="absolute -top-1 left-[14%] size-1.5 animate-ping rounded-full bg-[rgba(120,100,80,0.6)]" />
      ) : null}
    </div>
  )
}

function PhaseIcon({ phase }: { phase: SeasonPhase }) {
  if (phase === "spring") return <Sprout className="size-3.5 text-[#5f9a55]" aria-hidden="true" />
  if (phase === "summer") return <Sun className="size-3.5 text-[#e0a53a]" aria-hidden="true" />
  return <Leaf className="size-3.5 text-[#c9743a]" aria-hidden="true" />
}

/* ================================================================== *
 * Season controls
 * ================================================================== */
function SeasonControls({
  season,
  phase,
  playing,
  harvested,
  canHarvest,
  reducedMotion,
  onScrub,
  onPlay,
  onJump,
  onHarvest,
  onReset,
}: {
  season: number
  phase: SeasonPhase
  playing: boolean
  harvested: boolean
  canHarvest: boolean
  reducedMotion: boolean
  onScrub: (v: number) => void
  onPlay: () => void
  onJump: (p: SeasonPhase) => void
  onHarvest: () => void
  onReset: () => void
}) {
  const phases: SeasonPhase[] = ["spring", "summer", "fall"]
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPlay}
            disabled={reducedMotion}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              reducedMotion
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            title={
              reducedMotion
                ? "Auto-play is off because your system prefers reduced motion — drag the timeline instead."
                : undefined
            }
          >
            {playing ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            {playing ? "Pause" : "Play season"}
          </button>
          <div className="flex overflow-hidden rounded-full border border-border">
            {phases.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onJump(p)}
                aria-pressed={phase === p}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  phase === p
                    ? "bg-primary/15 text-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {SEASON_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset farm
        </button>
      </div>

      {/* Timeline */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-0.5 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1">🌱 Spring</span>
          <span className="flex items-center gap-1">☀️ Summer</span>
          <span className="flex items-center gap-1">🌾 Fall</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={season}
          onChange={(e) => onScrub(Number.parseFloat(e.target.value))}
          aria-label="Season timeline"
          className="farm-season-slider h-2.5 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #a7c47f 0%, #7fae5a 30%, #e6c65a 55%, #d89b46 78%, #c07a3a 100%)",
          }}
        />
      </div>

      {/* Harvest */}
      {canHarvest && !harvested ? (
        <button
          type="button"
          onClick={onHarvest}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#c9743a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b5652f]"
        >
          <Scissors className="size-4" aria-hidden="true" />
          Harvest the fields
        </button>
      ) : harvested ? (
        <p className="flex items-center justify-center gap-1.5 rounded-full bg-[#f0e6d2] px-4 py-2 text-sm font-medium text-[#8a5a2a]">
          <Leaf className="size-4" aria-hidden="true" />
          Harvest complete — fields cleared for next season
        </p>
      ) : null}

      <style>{`
        .farm-season-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid var(--primary);
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          cursor: pointer;
        }
        .farm-season-slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid var(--primary);
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}

/* ================================================================== *
 * Metrics panel
 * ================================================================== */
function MetricsPanel({
  metrics,
  mix,
  onFocusCrop,
}: {
  metrics: ReturnType<typeof computeMetrics>
  mix: CropMix
  onFocusCrop: (id: CropId) => void
}) {
  const profitPositive = metrics.profit >= 0
  return (
    <aside className="order-2 flex shrink-0 flex-col gap-3 lg:order-1 lg:w-72">
      {/* Profit headline */}
      <div
        className={cn(
          "rounded-2xl border p-4",
          profitPositive
            ? "border-primary/30 bg-primary/8"
            : "border-[#c1553f]/40 bg-[#c1553f]/8",
        )}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <TrendingUp className="size-3.5" aria-hidden="true" />
          Projected profit / season
        </div>
        <p
          className={cn(
            "mt-1 font-serif text-3xl font-semibold tabular-nums",
            profitPositive ? "text-foreground" : "text-[#c1553f]",
          )}
        >
          {usd(metrics.profit)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {metrics.plantedAcres} of {TOTAL_ACRES} acres planted
        </p>
      </div>

      {/* Revenue / cost / water */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox
          icon={<Wallet className="size-4" aria-hidden="true" />}
          label="Revenue"
          value={usdCompact(metrics.revenue)}
        />
        <StatBox
          icon={<Wallet className="size-4" aria-hidden="true" />}
          label="Costs"
          value={usdCompact(metrics.cost)}
        />
        <StatBox
          icon={<Droplets className="size-4" aria-hidden="true" />}
          label="Water / season"
          value={`${metrics.waterMGal.toFixed(1)}M gal`}
        />
        <StatBox
          icon={<Leaf className="size-4" aria-hidden="true" />}
          label="Concentration"
          value={`${metrics.concentration}%`}
        />
      </div>

      {/* Crop legend */}
      <div className="flex flex-1 flex-col rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="font-serif text-base font-semibold text-foreground">
          Crop mix
        </h3>
        <ul className="mt-2 flex flex-col gap-1.5">
          {CROP_ORDER.map((id) => {
            const crop = CROP_BY_ID[id]
            const acres = mix[id]
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => acres > 0 && onFocusCrop(id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                    acres > 0
                      ? "hover:bg-muted"
                      : "cursor-default opacity-45",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-flex size-3 rounded-full"
                      style={{ background: crop.accent }}
                      aria-hidden="true"
                    />
                    <span className="text-sm text-foreground">{crop.name}</span>
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {acres} ac
                  </span>
                </button>
              </li>
            )
          })}
          {fallowAcres(mix) > 0 ? (
            <li className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="flex items-center gap-2">
                <span
                  className="inline-flex size-3 rounded-full"
                  style={{ background: FALLOW_CLAY.soil }}
                  aria-hidden="true"
                />
                <span className="text-sm text-muted-foreground">Fallow</span>
              </span>
              <span className="text-sm tabular-nums text-muted-foreground">
                {fallowAcres(mix)} ac
              </span>
            </li>
          ) : null}
        </ul>
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Figures are illustrative prototype estimates, not local projections.
      </p>
    </aside>
  )
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground">{icon}</div>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-serif text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

/* ================================================================== *
 * Crop mix control
 * ================================================================== */
function CropMixControl({
  mix,
  onChange,
}: {
  mix: CropMix
  onChange: (id: CropId, value: number) => void
}) {
  const planted = mixTotal(mix)
  const fallow = fallowAcres(mix)
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
          <Sprout className="size-5 text-primary" aria-hidden="true" />
          Crop mix
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {planted}/{TOTAL_ACRES} ac planted · {fallow} fallow
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {CROP_ORDER.map((id) => {
          const crop = CROP_BY_ID[id]
          const acres = mix[id]
          const others = planted - acres
          const max = TOTAL_ACRES - others
          return (
            <div key={id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span
                    className="inline-flex size-3 rounded-full"
                    style={{ background: crop.accent }}
                    aria-hidden="true"
                  />
                  {crop.name}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {acres} ac
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={TOTAL_ACRES}
                step={5}
                value={acres}
                onChange={(e) => onChange(id, Number.parseInt(e.target.value, 10))}
                aria-label={`${crop.name} acreage`}
                className="farm-crop-slider h-2 w-full cursor-pointer appearance-none rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${crop.accent} ${(acres / TOTAL_ACRES) * 100}%, #e6dcc8 ${(acres / TOTAL_ACRES) * 100}%)`,
                  // visually communicate the remaining headroom
                  ["--crop-max" as string]: `${(max / TOTAL_ACRES) * 100}%`,
                }}
              />
            </div>
          )
        })}
      </div>

      <style>{`
        .farm-crop-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid var(--primary);
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
          cursor: pointer;
        }
        .farm-crop-slider::-moz-range-thumb {
          height: 18px;
          width: 18px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid var(--primary);
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}

/* ================================================================== *
 * Diversity control
 * ================================================================== */
function DiversityControl({
  diversity,
  concentration,
  risk,
  onChange,
}: {
  diversity: number
  concentration: number
  risk: ReturnType<typeof computeMetrics>["risk"]
  onChange: (t: number) => void
}) {
  const riskColor = RISK_COLORS[risk]
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
          <Leaf className="size-5 text-primary" aria-hidden="true" />
          Crop diversity
        </h3>
      </div>

      <div className="flex flex-col gap-1.5">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={diversity}
          onChange={(e) => onChange(Number.parseFloat(e.target.value))}
          aria-label="Crop diversity"
          className="farm-crop-slider h-2.5 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background: `linear-gradient(90deg, #b98a4a 0%, #7fae5a 100%)`,
          }}
        />
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Single crop</span>
          <span>Diversified farm</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Crop concentration
          </p>
          <p className="font-serif text-2xl font-semibold tabular-nums text-foreground">
            {concentration}%
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Risk level
          </p>
          <p
            className="font-serif text-2xl font-semibold"
            style={{ color: riskColor }}
          >
            {risk}
          </p>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Concentration and risk are illustrative prototype estimates. A single
        dominant crop concentrates both price and weather risk; a diversified
        mix spreads it across more markets.
      </p>
    </div>
  )
}

/* ================================================================== *
 * Floating crop card
 * ================================================================== */
function CropCard({
  crop,
  acres,
  onClose,
}: {
  crop: (typeof CROPS)[number]
  acres: number
  onClose: () => void
}) {
  const profitPerAcre = crop.revenuePerAcre - crop.costPerAcre
  return (
    <div className="absolute inset-x-3 bottom-3 z-30 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-xl backdrop-blur-md sm:inset-x-auto sm:left-1/2 sm:w-[22rem] sm:-translate-x-1/2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex size-3 rounded-full"
            style={{ background: crop.accent }}
            aria-hidden="true"
          />
          <h3 className="font-serif text-lg font-semibold text-foreground">
            {crop.name}
          </h3>
          <span className="text-xs tabular-nums text-muted-foreground">
            {acres} ac
          </span>
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

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Revenue / ac" value={usd(crop.revenuePerAcre)} />
        <MiniStat label="Cost / ac" value={usd(crop.costPerAcre)} />
        <MiniStat label="Margin / ac" value={usd(profitPerAcre)} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <MiniStat label="Water" value={`${crop.waterInches}"/season`} />
        <MiniStat
          label="On this farm"
          value={acres > 0 ? usd(profitPerAcre * acres) : "—"}
        />
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-2 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-serif text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

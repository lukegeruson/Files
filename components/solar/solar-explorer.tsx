"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import {
  BatteryCharging,
  ChevronDown,
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

// Hotspots: percentage positions tuned to the diorama so a marker lands on the
// real object. The stage is square and the image is square, so x/y map 1:1.
type Hotspot = { id: ComponentId; x: number; y: number }

const HOTSPOTS: Hotspot[] = [
  { id: "sun", x: 50, y: 14 }, // sits on the sun's high-noon apex
  { id: "panels", x: 55, y: 36 }, // nudged up/right so flow lines don't overlap
  { id: "inverter", x: 25, y: 52 },
  // The battery marker doubles as the home: all household energy converges here,
  // so there is no separate "home" point.
  { id: "battery", x: 33, y: 61 },
  { id: "grid", x: 88, y: 24 },
]

// Solar-generated electricity is drawn in warm amber. Grid-sourced power (which
// is what carries the home at night) is drawn in blue so the two are easy to
// tell apart. Direction is conveyed by the dashes animating source -> dest.
const ELECTRIC = "#f5b445"
const GRID_ELECTRIC = "#4da3ff"

// Energy-flow segments drawn between hotspots. `keys` selects the flow value(s)
// on the current frame (the line is active if ANY listed flow is carrying
// power); `solarDriven` flows depend only on solar generation.
type FlowKey =
  | "solarToHome"
  | "solarToBattery"
  | "solarToGrid"
  | "gridToHome"
  | "batteryToHome"

type Segment = {
  from: ComponentId
  to: ComponentId
  keys?: FlowKey[]
  solarDriven?: boolean
  // Part of the grid -> inverter -> battery path that carries the home at night.
  // These light up blue whenever the home is running on grid power (i.e. after
  // dark, once the panels stop generating).
  gridPath?: boolean
}

// The battery marker represents the home hub, so the wiring mirrors a real
// hybrid solar system:
//   sun -> panels          light hits the array
//   panels -> inverter     DC generation flows to the inverter
//   inverter -> battery    inverter charges the battery and powers the home
//   inverter -> grid       excess solar is exported
//   grid -> inverter       the grid feeds the inverter when solar is short
//                          (e.g. at night); the inverter then powers the
//                          battery/home, so the grid path runs
//                          grid -> inverter -> battery.
const SEGMENTS: Segment[] = [
  { from: "sun", to: "panels", solarDriven: true },
  { from: "panels", to: "inverter", solarDriven: true },
  {
    from: "inverter",
    to: "battery",
    keys: ["solarToHome", "solarToBattery", "gridToHome"],
    gridPath: true,
  },
  { from: "inverter", to: "grid", keys: ["solarToGrid"] },
  { from: "grid", to: "inverter", keys: ["gridToHome"], gridPath: true },
]

// Fixed star field for the night sky (deterministic so it doesn't reshuffle).
const STARS = Array.from({ length: 40 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  return {
    x: r(1) * 100,
    y: r(2) * 62, // keep stars in the upper ~2/3 (above the horizon)
    size: 1 + r(3) * 2,
    tw: 0.4 + r(4) * 0.6,
    dur: 2.5 + r(5) * 3,
    delay: r(6) * 4,
  }
})

// Linear interpolation helpers for blending sky colors between key times.
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}
function mix(c1: number[], c2: number[], t: number) {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))}, ${Math.round(
    lerp(c1[1], c2[1], t),
  )}, ${Math.round(lerp(c1[2], c2[2], t))})`
}

// Key sky "moods" across the day. Each has a top and bottom gradient color.
type Mood = { top: number[]; bottom: number[] }
const MOODS: Record<string, Mood> = {
  night: { top: [12, 16, 38], bottom: [26, 26, 54] },
  dawn: { top: [58, 62, 120], bottom: [244, 168, 122] }, // pink/orange sunrise
  day: { top: [125, 196, 240], bottom: [214, 236, 248] }, // bright blue
  dusk: { top: [70, 54, 110], bottom: [240, 132, 96] }, // orange/purple sunset
}

// Compute the full sky state for a given hour (0-24).
function skyForHour(hour: number) {
  const h = ((hour % 24) + 24) % 24

  // Blend between moods based on time windows.
  let top: string
  let bottom: string
  let starOpacity = 0
  if (h < 5) {
    top = mix(MOODS.night.top, MOODS.night.top, 0)
    bottom = mix(MOODS.night.bottom, MOODS.night.bottom, 0)
    starOpacity = 1
  } else if (h < 7) {
    const t = (h - 5) / 2 // night -> dawn
    top = mix(MOODS.night.top, MOODS.dawn.top, t)
    bottom = mix(MOODS.night.bottom, MOODS.dawn.bottom, t)
    starOpacity = 1 - t
  } else if (h < 9) {
    const t = (h - 7) / 2 // dawn -> day
    top = mix(MOODS.dawn.top, MOODS.day.top, t)
    bottom = mix(MOODS.dawn.bottom, MOODS.day.bottom, t)
  } else if (h < 16) {
    top = mix(MOODS.day.top, MOODS.day.top, 0) // full day
    bottom = mix(MOODS.day.bottom, MOODS.day.bottom, 0)
  } else if (h < 18.5) {
    const t = (h - 16) / 2.5 // day -> dusk
    top = mix(MOODS.day.top, MOODS.dusk.top, t)
    bottom = mix(MOODS.day.bottom, MOODS.dusk.bottom, t)
  } else if (h < 20.5) {
    const t = (h - 18.5) / 2 // dusk -> night
    top = mix(MOODS.dusk.top, MOODS.night.top, t)
    bottom = mix(MOODS.dusk.bottom, MOODS.night.bottom, t)
    starOpacity = t
  } else {
    top = mix(MOODS.night.top, MOODS.night.top, 0)
    bottom = mix(MOODS.night.bottom, MOODS.night.bottom, 0)
    starOpacity = 1
  }

  // Daytime factor 0..1 (0 = fully dark, 1 = midday) drives sun vs moon.
  const isDay = h >= 6 && h <= 20
  // Sun/moon arc: map its visible window to a left->right path, arcing up.
  const dayStart = 6
  const dayEnd = 20
  const p = isDay
    ? (h - dayStart) / (dayEnd - dayStart) // 0..1 across the day
    : // Night window wraps 20 -> 24 -> 6
      (((h - 20 + 24) % 24) / 10)
  const bodyX = lerp(8, 92, p)
  // Parabolic height: highest at midday / midnight (p=0.5).
  const arc = 1 - Math.pow((p - 0.5) * 2, 2) // 0 at ends, 1 at middle
  const bodyY = lerp(78, 14, arc)

  // Fade the body out as it dips beneath the diorama floor line, so it never
  // shows floating in the dark corner below the ground. Trajectory is unchanged
  // — only visibility near the horizon is cut.
  const FLOOR = 54 // % height where the ground plane begins
  const bodyOpacity = Math.max(0, Math.min(1, 1 - (bodyY - FLOOR) / 6))

  const sunUp = h > 6.5 && h < 19.5
  const goldenLow = (h >= 6.5 && h < 8.5) || (h > 16.5 && h < 19.5)

  const bodyColor = isDay
    ? goldenLow
      ? "radial-gradient(circle at 40% 40%, #ffe7a8, #ffb454 70%)"
      : "radial-gradient(circle at 40% 40%, #fff6d8, #ffd23f 72%)"
    : "radial-gradient(circle at 38% 34%, #fdfbe8, #d7dcc4 78%)" // moon

  const bodyGlow = isDay
    ? goldenLow
      ? "0 0 45px 18px rgba(255,150,60,0.55)"
      : "0 0 60px 26px rgba(255,214,90,0.6)"
    : "0 0 26px 8px rgba(210,220,255,0.35)"

  // Diorama lighting: warm/dim at golden hour, dark blue-ish at night.
  let dioramaFilter = "none"
  if (!sunUp) {
    dioramaFilter = "brightness(0.62) saturate(0.85) hue-rotate(200deg)"
  } else if (goldenLow) {
    dioramaFilter = "brightness(1.02) saturate(1.15) sepia(0.22)"
  }

  return {
    gradient: `linear-gradient(to bottom, ${top} 0%, ${bottom} 100%)`,
    starOpacity,
    bodyX,
    bodyY,
    bodyOpacity,
    bodyColor,
    bodyGlow,
    dioramaFilter,
    sunUp,
  }
}

const TICKS: Array<{ label: string; icon: typeof Sun }> = [
  { label: "Morning", icon: Sunrise },
  { label: "Midday", icon: Sun },
  { label: "Evening", icon: Sunset },
  { label: "Night", icon: Moon },
]

// Legend for the vertical desktop slider. The axis is a full day rotated so
// that noon sits at the top and midnight in the middle (see VerticalTimeSlider).
// Reading top → bottom follows the day forward: noon, evening, midnight,
// morning, and back to noon. `pos` is the percentage from the bottom of the
// track where each label sits.
const VERTICAL_TICKS: Array<{ label: string; icon: typeof Sun; pos: number }> = [
  { label: "Noon", icon: Sun, pos: 100 },
  { label: "Evening", icon: Sunset, pos: 75 },
  { label: "Midnight", icon: Moon, pos: 50 },
  { label: "Morning", icon: Sunrise, pos: 25 },
  { label: "Noon", icon: Sun, pos: 0 },
]

const DAY_SECONDS = 18 // one simulated day plays over ~18s

export function SolarExplorer() {
  const { snapshot, timeline } = useSolarScene()

  const [hour, setHour] = useState(12)
  const [playing, setPlaying] = useState(false)
  const [selected, setSelected] = useState<ComponentId | null>(null)
  const [showSavings, setShowSavings] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  // Mobile-only: whether the middle stat rows of the "Right now" card are shown.
  const [statsExpanded, setStatsExpanded] = useState(false)

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

  // "Run day" animation loop. The day plays forward and STOPS completely each
  // time it reaches high noon or midnight — it will not resume until the user
  // presses the button again (which advances toward the next stopping point).
  const raf = useRef<number | null>(null)
  const last = useRef<number | null>(null)
  const hourRef = useRef(hour)
  // Keep the ref in sync when the hour changes from outside the loop (slider).
  useEffect(() => {
    hourRef.current = hour
  }, [hour])
  useEffect(() => {
    if (!playing || reducedMotion) return
    const tick = (now: number) => {
      if (last.current != null) {
        const dtSec = (now - last.current) / 1000
        const cur = hourRef.current
        let next = cur + dtSec * (24 / DAY_SECONDS)
        // Did we just cross noon (12) or midnight (24 -> 0) this frame?
        const crossedNoon = cur < 12 && next >= 12
        const crossedMidnight = next >= 24
        if (crossedNoon || crossedMidnight) {
          const landed = crossedMidnight ? 0 : 12
          hourRef.current = landed
          setHour(landed)
          last.current = null
          setPlaying(false) // full stop — no auto-resume
          return
        }
        if (next >= 24) next -= 24
        hourRef.current = next
        setHour(next)
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

  const sky = useMemo(() => skyForHour(hour), [hour])

  const hotspots = HOTSPOTS
  const posOf = useMemo(() => {
    const map = {} as Record<ComponentId, Hotspot>
    for (const h of hotspots) map[h.id] = h
    return map
  }, [hotspots])

  const gridExporting = frame.gridKw > 0.05
  const gridImporting = frame.gridKw < -0.05

  function handleReset() {
    setSelected(null)
    setPlaying(false)
    setHour(12)
    setShowSavings(false)
  }

  // Which segments are currently carrying energy. A segment with multiple keys
  // is active when any of its flows is carrying power.
  // After dark the panels stop and the home is carried from the grid, so the
  // grid -> inverter -> battery path is drawn even though the scene's reserve
  // battery is what physically covers the small overnight load.
  const nightSupply = !sky.sunUp && frame.consumptionKw > 0.02
  const activeSegments = SEGMENTS.map((seg) => {
    const solarActive = seg.solarDriven ? frame.solarKw > 0.05 : false
    const keyActive = seg.keys
      ? seg.keys.some((k) => frame.flows[k] > 0.05)
      : false
    const gridActive = !!seg.gridPath && nightSupply
    const active = solarActive || keyActive || gridActive
    // The grid path renders blue whenever it is the grid (not the panels)
    // powering the home; everything solar-driven stays amber.
    const gridDriven =
      !!seg.gridPath &&
      !solarActive &&
      (gridActive || frame.flows.gridToHome > 0.05)
    const color = gridDriven ? GRID_ELECTRIC : ELECTRIC
    return { seg, active, color }
  })

  // Shared inner content for the "Right now" live-stats card. Rendered above the
  // simulator on mobile and as a corner overlay on larger screens. When
  // `collapsible` is set (mobile), the middle stat rows can be toggled via a
  // button in the header, leaving only the "Right now" and "Saved today" rows.
  const renderLiveStats = (collapsible: boolean) => {
    const rowsVisible = collapsible ? statsExpanded : true
    return (
      <>
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-r from-primary/12 to-transparent px-3 py-2">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Right now
            </p>
            {collapsible ? (
              <button
                type="button"
                onClick={() => setStatsExpanded((v) => !v)}
                aria-expanded={statsExpanded}
                aria-label={
                  statsExpanded ? "Hide energy details" : "Show energy details"
                }
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background/70 hover:text-foreground"
              >
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform duration-200",
                    statsExpanded && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
            ) : null}
          </div>
          <span className="rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-foreground">
            {frame.label}
          </span>
        </div>
        {rowsVisible ? (
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
        ) : null}
        <div className="border-t border-border/60 bg-gradient-to-r from-primary/8 to-transparent px-3 py-2">
          <p className="text-[11px] text-muted-foreground">Saved today</p>
          <p className="font-serif text-xl tabular-nums text-foreground">
            {money(frame.savingsSoFar, 2)}
          </p>
        </div>
      </>
    )
  }

  // Desktop-only part description. On desktop this replaces the on-stage popup:
  // it sits at the top of the left column and swaps its contents as different
  // parts are clicked, falling back to a prompt when nothing is selected.
  const renderPartInfo = () => {
    const info = selected ? COMPONENT_INFO[selected] : null
    return (
      <>
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-r from-primary/12 to-transparent px-3 py-2">
          <p className="font-serif text-sm font-semibold text-foreground">
            {info ? info.title : "Solar parts"}
          </p>
          {selected ? (
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Clear selection"
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <p className="min-h-0 flex-1 overflow-auto px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {info
            ? info.blurb
            : "Tap any marker on the diagram to see what that part does."}
        </p>
      </>
    )
  }

  // Time-of-day slider. Shown below the "Right now" card in the desktop left
  // column, and inside the Controls block on mobile. Both copies live in the
  // DOM (toggled by CSS), so each needs a unique id.
  const renderTimeline = (id: string) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
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
          id={id}
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
  )

  // Vertical variant of the timeline used in the desktop left column. It fills
  // the height of its card so the two info boxes together match the stage.
  // Top = noon (brightest), middle = midnight, bottom = noon — a full day
  // rotated so midday leads at the top.
  const renderTimelineVertical = () => (
    <div className="flex h-full flex-col gap-2">
      {/* Header stacks so it fits the thin box. */}
      <div className="flex flex-col items-center gap-1 pb-2">
        <span className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Time of day
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-stretch gap-2 pt-1">
        {/* Ticks positioned to match the gradient: noon (bright) at top and
            bottom, midnight (dark) in the middle. The inner region is inset
            vertically so the top/bottom labels don't clip into the header.
            Ticks sit to the left of the slider. */}
        <div className="relative flex-1 text-[11px] text-muted-foreground">
          <div className="absolute inset-x-0 inset-y-2">
            {VERTICAL_TICKS.map((t) => {
              const Icon = t.icon
              return (
                <span
                  key={`${t.label}-${t.pos}`}
                  className="absolute flex -translate-y-1/2 items-center gap-1.5"
                  style={{ bottom: `${t.pos}%` }}
                >
                  <Icon className="size-3 shrink-0" aria-hidden="true" />
                  {t.label}
                </span>
              )
            })}
          </div>
        </div>
        {/* Slider on the right edge of the box (closest to the stage). */}
        <VerticalTimeSlider
          value={hour}
          onChange={(h) => {
            setPlaying(false)
            setHour(h)
          }}
          ariaLabel="Time of day"
        />
      </div>
    </div>
  )

  // Playback controls (Run day / Savings / Reset). Shown in the desktop left
  // column and inside the Controls block on mobile.
  const controlButtons = (
    <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:flex-nowrap sm:items-stretch">
      <ControlButton
        onClick={() => setPlaying((p) => !p)}
        disabled={reducedMotion}
        active={playing}
        primary
        className="sm:w-full sm:justify-center"
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
        className="sm:w-full sm:justify-center"
      >
        <Zap className="size-4" aria-hidden="true" />
        Savings
      </ControlButton>
      <ControlButton
        onClick={handleReset}
        className="sm:w-full sm:justify-center"
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Reset
      </ControlButton>
    </div>
  )

  return (
    <section aria-label="Solar Energy Explorer" className="flex flex-col gap-4">
      {/* Heading */}
      <div className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary">
          <Sparkles className="size-3" aria-hidden="true" />
          Interactive diagram
        </span>
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-balance md:text-3xl">
          Solar Energy Explorer
        </h2>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Tap any part and run a day to see how home solar works.
        </p>
      </div>

      {/* Live stats — on mobile this sits above the simulator (instead of
          overlaying it). The corner-overlay version below is desktop-only. */}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-sm ring-1 ring-black/5 sm:hidden">
        {renderLiveStats(true)}
      </div>

      {/* Simulator row — on desktop the "Right now" bar sits in a column to the
          left of the stage; on mobile the stage stands alone (the collapsible
          card above handles the mobile live stats). The left column stretches to
          the stage height so both info boxes span the same vertical space as the
          house visual. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:justify-center sm:gap-3">
        {/* Desktop-only controls to the left of the stage. The far-left column
            stacks three groups over the full stage height — the part
            description on top, the "Right now" card in the middle, and the
            playback buttons at the bottom — beside a thin, full-height "Time of
            day" box whose slider runs down its right edge (closest to the
            stage). */}
        <div className="hidden shrink-0 items-stretch gap-3 sm:flex">
          <div className="flex w-44 flex-col gap-3">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-sm ring-1 ring-black/5">
              {renderPartInfo()}
            </div>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/90 shadow-sm ring-1 ring-black/5">
              {renderLiveStats(false)}
            </div>
            <div>{controlButtons}</div>
          </div>
          <div className="flex w-28 shrink-0 flex-col rounded-xl border border-border bg-card p-3 shadow-sm">
            {renderTimelineVertical()}
          </div>
        </div>

        {/* Stage — an animated sky sits behind the transparent-backed diorama,
            so the whole scene runs through sunrise, day, sunset and night as the
            time of day changes. */}
        <div className="relative aspect-square w-full max-w-2xl overflow-hidden rounded-3xl">
        {/* Sky gradient (dawn -> day -> dusk -> night) */}
        <div
          className="absolute inset-0 transition-[background] duration-700 ease-linear"
          style={{ background: sky.gradient }}
          aria-hidden="true"
        />

        {/* Stars — fade in at night */}
        <div
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: sky.starOpacity }}
          aria-hidden="true"
        >
          {STARS.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.size,
                height: s.size,
                opacity: s.tw,
                animation: reducedMotion
                  ? undefined
                  : `sky-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Celestial body — sun by day, moon by night — arcs across the sky.
            Fades out as it dips below the floor line so it never floats in the
            dark corner beneath the ground. */}
        <div
          className="absolute transition-[opacity,color] duration-700"
          style={{
            left: `${sky.bodyX}%`,
            top: `${sky.bodyY}%`,
            width: "18%",
            height: "18%",
            opacity: sky.bodyOpacity,
            transform: "translate(-50%, -50%)",
          }}
          aria-hidden="true"
        >
          <div
            className="size-full rounded-full transition-all duration-700"
            style={{
              background: sky.bodyColor,
              boxShadow: sky.bodyGlow,
            }}
          />
        </div>

        {/* Transparent diorama (real alpha). Its lighting is tinted warm at
            golden hour and dimmed at night to match the sky. */}
        <Image
          src={DIORAMA_SRC || "/placeholder.svg"}
          alt="Claymation model of a home solar system"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 672px"
          className="object-contain transition-[filter] duration-700"
          style={{ filter: sky.dioramaFilter }}
        />

          {/* Energy-flow overlay */}
          <svg
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-0 size-full"
            aria-hidden="true"
          >
            {activeSegments.map(({ seg, active, color }) => {
              const a = posOf[seg.from]
              const b = posOf[seg.to]
              if (!a || !b) return null
              return (
                <line
                  key={`${seg.from}-${seg.to}-${seg.keys?.join("+") ?? "solar"}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={color}
                  strokeWidth={active ? 0.8 : 0.45}
                  strokeLinecap="round"
                  strokeDasharray="1.6 2.2"
                  className={cn(
                    "transition-opacity duration-500",
                    active ? "opacity-95 solar-flow" : "opacity-0",
                  )}
                  style={{
                    filter: active
                      ? `drop-shadow(0 0 1.4px ${color})`
                      : undefined,
                  }}
                />
              )
            })}
          </svg>

          {/* Hotspots */}
          {hotspots.map((h) => {
            // The sun marker only exists while the sun is up; once it sets and
            // the moon rises, the marker disappears. The solar-panel marker is
            // likewise hidden at night, since the array isn't generating.
            if ((h.id === "sun" || h.id === "panels") && !sky.sunUp) return null
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

          {/* Selected component popup — mobile only. On desktop the same
              description is shown in the left column (renderPartInfo). */}
          {selected ? (
            <div className="sm:hidden">
              <SelectedCard
                id={selected}
                pos={posOf[selected]}
                onClose={() => setSelected(null)}
              />
            </div>
          ) : null}

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
      </div>

      {/* Controls — mobile only; on desktop the buttons and timeline live in
          the left column beside the simulator. */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:hidden">
        {controlButtons}
        <div>{renderTimeline("solar-timeline-mobile")}</div>
      </div>

      <style jsx>{`
        @keyframes sky-twinkle {
          0%,
          100% {
            opacity: 0.25;
          }
          50% {
            opacity: 1;
          }
        }
        .solar-flow {
          animation: solar-flow-dash 0.55s linear infinite;
        }
        @keyframes solar-flow-dash {
          to {
            stroke-dashoffset: -3.8;
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

// Custom vertical time-of-day slider. Native vertical <input type="range"> is
// unreliable across browsers (the thumb fails to track the value), so this uses
// pointer + keyboard handling with an absolutely-positioned thumb. The track
// runs bottom (0:00) to top (24:00).
function VerticalTimeSlider({
  value,
  onChange,
  ariaLabel,
}: {
  value: number
  onChange: (hour: number) => void
  ariaLabel: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  // The track is a full day rotated so noon is at the top and bottom while
  // midnight sits in the middle. Position `p` runs 0 (bottom) → 1 (top):
  //   top half   [0.5, 1] → hours 24 → 12  (midnight up to noon)
  //   bottom half [0, 0.5) → hours 12 → 0   (noon down to midnight)
  const hourToPos = (h: number) => (h >= 12 ? (36 - h) / 24 : (12 - h) / 24)
  const posToHour = (p: number) => {
    const clamped = Math.max(0, Math.min(1, p))
    const h = clamped >= 0.5 ? 36 - 24 * clamped : 12 - 24 * clamped
    return Math.round(h * 4) / 4 // snap to 0.25h steps
  }

  const setFromClientY = (clientY: number) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.height === 0) return
    const p = 1 - (clientY - rect.top) / rect.height
    onChange(posToHour(p))
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setFromClientY(e.clientY)
  }
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current) setFromClientY(e.clientY)
  }
  const endDrag = () => {
    dragging.current = false
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Operate on position so the thumb always moves in the pressed direction,
    // regardless of how hours wrap across the rotated axis.
    let p = hourToPos(value)
    const small = 0.25 / 24
    const big = 1 / 24
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        p += small
        break
      case "ArrowDown":
      case "ArrowLeft":
        p -= small
        break
      case "PageUp":
        p += big
        break
      case "PageDown":
        p -= big
        break
      case "Home":
        p = 0
        break
      case "End":
        p = 1
        break
      default:
        return
    }
    e.preventDefault()
    onChange(posToHour(Math.max(0, Math.min(1, p))))
  }

  const pct = hourToPos(value) * 100

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={24}
      aria-valuenow={Math.round(value)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className="relative h-full w-2.5 shrink-0 cursor-pointer touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      style={{
        background:
          "linear-gradient(to top, #ffe6a8 0%, #f5b445 12%, #6b5b95 34%, #1e293b 50%, #6b5b95 66%, #f5b445 88%, #ffe6a8 100%)",
      }}
    >
      <span
        className="pointer-events-none absolute left-1/2 size-5 -translate-x-1/2 translate-y-1/2 rounded-full border-[3px] border-primary bg-white shadow-md"
        style={{ bottom: `${pct}%` }}
        aria-hidden="true"
      />
    </div>
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
  className,
  }: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
  primary?: boolean
  disabled?: boolean
  title?: string
  className?: string
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
  className,
  )}
  >
      {children}
    </button>
  )
}

"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Droplets,
  Leaf,
  RotateCcw,
  Sparkles,
  Sprout,
  TreesIcon as TreePine,
  Wand2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  computeLandscapePlan,
  elementCard,
  formatArea,
  formatGallons,
  money,
  type ElementId,
} from "@/lib/landscape-scene"

// Two matched clay renders of the SAME cottage-corner yard: a lush lawn state
// and a water-wise xeriscape state. The slider crossfades between them, so the
// yard appears to physically transform as you drag.
const LAWN_SRC = "/landscape-styles/corner-lawn.png"
const WATERWISE_SRC = "/landscape-styles/option-c-corner3d.png"

// Clickable hotspots, tuned as percentages over the water-wise render. Each maps
// to a selectable element in the model. Positions follow the cottage-corner
// composition: house at back-right, yard filling the foreground.
const HOTSPOTS: Array<{
  id: ElementId
  label: string
  x: number
  y: number
}> = [
  { id: "lawn", label: "Lawn", x: 33, y: 58 },
  { id: "planting", label: "Planting beds", x: 60, y: 62 },
  { id: "mulch", label: "Mulch", x: 46, y: 70 },
  { id: "gravel", label: "Gravel", x: 70, y: 74 },
  { id: "drip", label: "Drip irrigation", x: 52, y: 55 },
  { id: "patio", label: "Patio", x: 40, y: 48 },
  { id: "trees", label: "Shade trees", x: 24, y: 34 },
]

// Legend / selectable elements, in display order, with clay swatch colors.
const LEGEND: Array<{ id: ElementId; label: string; swatch: string }> = [
  { id: "lawn", label: "Lawn", swatch: "#84a955" },
  { id: "planting", label: "Planting", swatch: "#6f9350" },
  { id: "mulch", label: "Mulch", swatch: "#8a5a38" },
  { id: "gravel", label: "Gravel", swatch: "#bcae8b" },
  { id: "drip", label: "Drip", swatch: "#5b9bd0" },
  { id: "patio", label: "Patio", swatch: "#c7bfb0" },
  { id: "trees", label: "Trees", swatch: "#5c8040" },
]

export function LandscapeExplorer() {
  const [waterWise, setWaterWise] = useState(0)
  const [selected, setSelected] = useState<ElementId | null>(null)
  const [playing, setPlaying] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Refs mirror state for the rAF animation loop without stale closures.
  const wRef = useRef(waterWise)
  wRef.current = waterWise
  const target = useRef(1)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  // Auto-morph animation toward the target end of the slider.
  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      return
    }
    const tick = () => {
      const cur = wRef.current
      const dest = target.current
      const next = cur + (dest - cur) * 0.08
      if (Math.abs(dest - next) < 0.004) {
        setWaterWise(dest)
        setPlaying(false)
        return
      }
      setWaterWise(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [playing])

  const plan = useMemo(() => computeLandscapePlan(waterWise), [waterWise])
  const card = selected ? elementCard(plan, selected) : null

  // Hotspots only make sense once the yard has become water-wise enough to show
  // the xeriscape elements; fade them in with the transformation.
  const hotspotOpacity = Math.max(0, (waterWise - 0.25) / 0.75)

  function handleReset() {
    setPlaying(false)
    setSelected(null)
    setWaterWise(0)
  }

  function handleMorph() {
    if (reducedMotion) {
      setWaterWise((w) => (w < 0.5 ? 1 : 0))
      return
    }
    target.current = wRef.current < 0.5 ? 1 : 0
    setPlaying((p) => !p)
  }

  return (
    <section
      aria-label="Landscape Planner Explorer"
      className="flex flex-col gap-4"
    >
      {/* Heading */}
      <div className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary">
          <Sparkles className="size-3" aria-hidden="true" />
          Interactive model
        </span>
        <h2 className="font-serif text-2xl font-semibold tracking-tight text-balance md:text-3xl">
          Landscape Planner Explorer
        </h2>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Slide from a traditional lawn to a water-wise yard and watch the clay
          model transform. Tap any area to see what it costs and how much water
          it uses.
        </p>
      </div>

      {/* Desktop: controls column on the left, visual stage on the right. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Stage — two matched clay renders crossfade on the slider */}
      <div
        className="relative aspect-square w-full max-w-2xl self-center overflow-hidden rounded-3xl border border-[#e4d9c2] lg:order-last lg:min-w-0 lg:flex-1 lg:self-start"
        style={{
          background:
            "radial-gradient(120% 100% at 50% 22%, #f7efdf 0%, #f4ecda 60%, #f1e7d3 100%)",
        }}
        onClick={() => setSelected(null)}
      >
        {/* Lush lawn base */}
        <img
          src={LAWN_SRC || "/placeholder.svg"}
          alt="Clay model of a traditional lush-lawn backyard"
          className="pointer-events-none absolute inset-0 size-full select-none object-contain"
          draggable={false}
        />
        {/* Water-wise overlay, revealed as the slider advances */}
        <img
          src={WATERWISE_SRC || "/placeholder.svg"}
          alt="Clay model of the same backyard converted to a water-wise xeriscape"
          className="pointer-events-none absolute inset-0 size-full select-none object-contain transition-opacity duration-300"
          style={{ opacity: waterWise }}
          draggable={false}
        />

        {/* Dim veil when an element is selected, to focus its hotspot */}
        <div
          className="pointer-events-none absolute inset-0 bg-[#2c2417] transition-opacity duration-300"
          style={{ opacity: selected ? 0.14 : 0 }}
        />

        {/* Clickable hotspots over the water-wise yard */}
        {HOTSPOTS.map((h) => {
          const isSel = selected === h.id
          return (
            <button
              key={h.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSelected((s) => (s === h.id ? null : h.id))
              }}
              aria-label={h.label}
              aria-pressed={isSel}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                left: `${h.x}%`,
                top: `${h.y}%`,
                opacity: isSel ? 1 : hotspotOpacity,
                pointerEvents: hotspotOpacity < 0.4 ? "none" : "auto",
                zIndex: isSel ? 15 : 8,
              }}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full border-2 border-white bg-primary text-primary-foreground shadow-md transition-all",
                  isSel ? "size-6 ring-2 ring-primary/40" : "size-5",
                )}
              >
                <span className="size-1.5 rounded-full bg-primary-foreground" />
              </span>
            </button>
          )
        })}

        {/* Floating info card */}
        {card ? (
          <div
            className="absolute bottom-3 left-3 right-3 z-20 max-w-xs rounded-2xl border border-[#e4d9c2] bg-card/95 p-3.5 shadow-lg backdrop-blur-sm sm:right-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <p className="font-serif text-lg font-semibold leading-none text-foreground">
                  {card.title}
                </p>
                <p className="text-sm font-medium text-foreground">{card.stat}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="-mr-1 -mt-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary">
                {card.tone}
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {money(card.cost)} est.
              </span>
            </div>
            <p className="mt-2 text-pretty text-xs leading-relaxed text-muted-foreground">
              {card.blurb}
            </p>
          </div>
        ) : null}
      </div>

      {/* Controls column — sits to the left of the stage on desktop */}
      <div className="flex flex-col gap-4 lg:order-first lg:w-80 lg:shrink-0">
      {/* Slider */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm font-medium">
          <span className="flex items-center gap-1.5 text-foreground">
            <Sprout className="size-4 text-[#84a955]" aria-hidden="true" />
            Traditional lawn
          </span>
          <span className="flex items-center gap-1.5 text-foreground">
            Water-wise
            <Droplets className="size-4 text-[#5b9bd0]" aria-hidden="true" />
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={waterWise}
          onChange={(e) => {
            setPlaying(false)
            setWaterWise(Number.parseFloat(e.target.value))
          }}
          className="landscape-slider h-3 w-full cursor-pointer appearance-none rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #84a955 0%, #b6a682 45%, #9c6a44 62%, #5b9bd0 100%)",
          }}
          aria-label="Traditional lawn to water-wise landscape"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ControlButton primary onClick={handleMorph} active={playing}>
            <Wand2 className="size-4" aria-hidden="true" />
            {playing ? "Transforming…" : "Transform"}
          </ControlButton>
          <ControlButton onClick={handleReset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset
          </ControlButton>
          {/* Legend doubles as an element selector. */}
          <div className="flex w-full flex-wrap items-center gap-1.5 lg:ml-0">
            {LEGEND.map((l) => {
              const isSel = selected === l.id
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelected((s) => (s === l.id ? null : l.id))}
                  aria-pressed={isSel}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    isSel
                      ? "border-primary bg-primary/12 font-medium text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-ring hover:text-foreground",
                  )}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: l.swatch }}
                    aria-hidden="true"
                  />
                  {l.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Metric labels attached to the model */}
      <div className="grid grid-cols-2 gap-2.5">
        <Metric
          icon={<Sparkles className="size-3.5 text-primary" aria-hidden="true" />}
          label="Estimated cost"
          value={money(plan.estimatedCost)}
          highlight
        />
        <Metric
          icon={<Leaf className="size-3.5 text-[#84a955]" aria-hidden="true" />}
          label="Landscape area"
          value={formatArea(plan.totalAreaSqft)}
        />
        <Metric
          icon={<Droplets className="size-3.5 text-[#5b9bd0]" aria-hidden="true" />}
          label="Annual irrigation"
          value={formatGallons(plan.annualIrrigationGal)}
        />
        <Metric
          icon={<Sprout className="size-3.5 text-[#6f9350]" aria-hidden="true" />}
          label="Planting area"
          value={formatArea(plan.plantingSqft)}
        />
        <Metric
          icon={<span className="size-2.5 rounded-full bg-[#8a5a38]" aria-hidden="true" />}
          label="Mulch"
          value={`${plan.mulchYards.toFixed(1)} yd³`}
        />
        <Metric
          icon={<span className="size-2.5 rounded-full bg-[#bcae8b]" aria-hidden="true" />}
          label="Gravel"
          value={formatArea(plan.area.gravel)}
        />
        <Metric
          icon={<Droplets className="size-3.5 text-[#5b9bd0]" aria-hidden="true" />}
          label="Irrigation zones"
          value={`${plan.totalZones} (${plan.dripZones} drip)`}
        />
        <Metric
          icon={<TreePine className="size-3.5 text-[#5c8040]" aria-hidden="true" />}
          label="Water reduction"
          value={`${plan.waterReductionPct}%`}
          highlight
        />
      </div>
      </div>
      </div>

      {/* Slider thumb styles, matching the solar explorer's approach. */}
      <style>{`
        .landscape-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 22px;
          width: 22px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid var(--primary);
          box-shadow: 0 1px 5px rgba(0, 0, 0, 0.28);
          cursor: pointer;
        }
        .landscape-slider::-moz-range-thumb {
          height: 22px;
          width: 22px;
          border-radius: 9999px;
          background: #ffffff;
          border: 3px solid var(--primary);
          box-shadow: 0 1px 5px rgba(0, 0, 0, 0.28);
          cursor: pointer;
        }
      `}</style>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Small shared UI
// ---------------------------------------------------------------------------
function ControlButton({
  children,
  onClick,
  primary,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  primary?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        primary
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "border-border bg-background text-foreground hover:border-ring",
        active && !primary && "border-primary bg-primary/12",
      )}
    >
      {children}
    </button>
  )
}

function Metric({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3 shadow-sm",
        highlight ? "border-primary/30 bg-primary/8" : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="font-serif text-xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

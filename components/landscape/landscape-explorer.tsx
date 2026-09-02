"use client"

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
  GRID_COLS,
  GRID_ROWS,
  money,
  type ElementId,
  type Material,
} from "@/lib/landscape-scene"

// ---------------------------------------------------------------------------
// Clay material palette. Muted, earthy, matte — every surface reads as the same
// tabletop-model clay, distinguished only by hue. Kept as literal values (like
// the solar explorer's sky colors) so the scene renders identically anywhere.
// ---------------------------------------------------------------------------
const MATERIALS: Record<
  Material,
  { label: string; top: string; bottom: string; dot: string }
> = {
  lawn: { label: "Lawn", top: "#a7c775", bottom: "#84a955", dot: "#8fb45f" },
  planting: {
    label: "Planting",
    top: "#8f6c4f",
    bottom: "#77543d",
    dot: "#6f9350",
  },
  mulch: { label: "Mulch", top: "#9c6a44", bottom: "#814f30", dot: "#8a5a38" },
  gravel: {
    label: "Gravel",
    top: "#cec1a3",
    bottom: "#b4a682",
    dot: "#bcae8b",
  },
}

const SHRUB = "radial-gradient(circle at 38% 32%, #82a862, #567c3e 78%)"
const TREE = "radial-gradient(circle at 36% 30%, #7ba35d, #4c703a 80%)"
const BLOOM = ["#d98a5a", "#e0b15a", "#cf7f86"] // clay flower dots

// Legend / selectable elements, in display order.
const LEGEND: Array<{ id: ElementId; label: string; swatch: string }> = [
  { id: "lawn", label: "Lawn", swatch: MATERIALS.lawn.bottom },
  { id: "planting", label: "Planting", swatch: MATERIALS.planting.dot },
  { id: "mulch", label: "Mulch", swatch: MATERIALS.mulch.bottom },
  { id: "gravel", label: "Gravel", swatch: MATERIALS.gravel.bottom },
  { id: "drip", label: "Drip", swatch: "#5b9bd0" },
  { id: "patio", label: "Patio", swatch: "#c7bfb0" },
  { id: "trees", label: "Trees", swatch: "#5c8040" },
]

// Deterministic pseudo-random in [0,1) so decorations never reshuffle.
function hash(i: number, n: number): number {
  const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
  return x - Math.floor(x)
}

// Grid geometry as percentages of the square stage.
const G = { left: 6, top: 31, width: 88, height: 62 }
const CELL_W = G.width / GRID_COLS
const CELL_H = G.height / GRID_ROWS

// Fixed clay trees (percent positions + size). Load-bearing scenery, always on.
const TREES = [
  { x: 15, y: 30, s: 12 },
  { x: 86, y: 34, s: 10 },
  { x: 90, y: 82, s: 11 },
]

const MORPH_SECONDS = 2.4

export function LandscapeExplorer() {
  const [waterWise, setWaterWise] = useState(0.35)
  const [selected, setSelected] = useState<ElementId | null>(null)
  const [playing, setPlaying] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  const plan = useMemo(() => computeLandscapePlan(waterWise), [waterWise])

  // Respect reduced-motion: no auto-morph, transitions still fine.
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

  // Auto-transform: glide toward the opposite end, then stop.
  const raf = useRef<number | null>(null)
  const last = useRef<number | null>(null)
  const target = useRef(1)
  const wRef = useRef(waterWise)
  useEffect(() => {
    wRef.current = waterWise
  }, [waterWise])
  useEffect(() => {
    if (!playing || reducedMotion) return
    const tick = (now: number) => {
      if (last.current != null) {
        const dt = (now - last.current) / 1000
        const dir = target.current >= wRef.current ? 1 : -1
        let next = wRef.current + (dir * dt) / MORPH_SECONDS
        if ((dir === 1 && next >= target.current) || (dir === -1 && next <= target.current)) {
          next = target.current
          wRef.current = next
          setWaterWise(next)
          setPlaying(false)
          last.current = null
          return
        }
        wRef.current = next
        setWaterWise(next)
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

  // Assign each grid tile a material: an open lawn at the front-center, ringed
  // by beds, then mulch, with gravel pushed to the back corners. As the yard
  // turns water-wise the lawn count drops and the farthest tiles convert first.
  const cells = useMemo(() => {
    const order = Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => i).sort(
      (a, b) => dist(a) - dist(b),
    )
    function dist(i: number) {
      const row = Math.floor(i / GRID_COLS)
      const col = i % GRID_COLS
      const dx = col - (GRID_COLS - 1) / 2
      const dy = row - (GRID_ROWS - 1) // focal point at front-center
      return dx * dx + dy * dy
    }
    const mat = new Array<Material>(order.length)
    let k = 0
    const put = (count: number, m: Material) => {
      for (let n = 0; n < count && k < order.length; n++) mat[order[k++]] = m
    }
    put(plan.cells.lawn, "lawn")
    put(plan.cells.planting, "planting")
    put(plan.cells.mulch, "mulch")
    while (k < order.length) mat[order[k++]] = "gravel"

    return Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => ({
      i,
      row: Math.floor(i / GRID_COLS),
      col: i % GRID_COLS,
      material: mat[i],
    }))
  }, [plan.cells])

  function handleReset() {
    setPlaying(false)
    setSelected(null)
    setWaterWise(0.35)
  }
  function handleMorph() {
    if (reducedMotion) {
      setWaterWise((w) => (w < 0.5 ? 1 : 0))
      return
    }
    target.current = wRef.current < 0.5 ? 1 : 0
    setPlaying((p) => !p)
  }

  const card = selected ? elementCard(plan, selected) : null
  const showDrip = plan.dripZones > 0
  const showSpray = plan.sprayZones > 0

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
          Slide from a traditional lawn to a water-wise yard and watch the model
          rearrange itself. Tap any area to see what it costs and how much water
          it uses.
        </p>
      </div>

      {/* Stage */}
      <div
        className="relative aspect-square w-full max-w-2xl self-center overflow-hidden rounded-3xl border border-[#e4d9c2]"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 20%, #f4ecda 0%, #ece0c8 70%, #e3d5b8 100%)",
        }}
        onClick={() => setSelected(null)}
      >
        {/* soft plot inset */}
        <div className="pointer-events-none absolute inset-3 rounded-[1.6rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-10px_30px_rgba(120,96,60,0.12)]" />

        {/* House footprint */}
        <HouseModel />

        {/* Tile grid */}
        {cells.map((c) => {
          const m = MATERIALS[c.material]
          const isSel = selected === c.material
          const dim = selected != null && !isSel && isMaterial(selected)
          const left = G.left + c.col * CELL_W
          const top = G.top + c.row * CELL_H
          return (
            <button
              key={c.i}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSelected((s) => (s === c.material ? null : c.material))
              }}
              aria-label={`${m.label} area`}
              aria-pressed={isSel}
              className="group absolute rounded-[0.7rem] outline-none transition-[transform,opacity,box-shadow] duration-500 focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                left: `${left + 0.5}%`,
                top: `${top + 0.5}%`,
                width: `${CELL_W - 1}%`,
                height: `${CELL_H - 1}%`,
                opacity: dim ? 0.55 : 1,
                transform: isSel ? "translateY(-2px)" : undefined,
                zIndex: isSel ? 5 : 1,
              }}
            >
              <span
                className={cn(
                  "absolute inset-0 rounded-[0.7rem] transition-colors duration-500",
                  isSel
                    ? "shadow-[0_6px_14px_rgba(80,60,35,0.28)] ring-2 ring-white/80"
                    : "shadow-[0_2px_5px_rgba(90,70,45,0.18)]",
                )}
                style={{
                  background: `linear-gradient(160deg, ${m.top} 0%, ${m.bottom} 100%)`,
                }}
              />
              <CellDecor
                material={c.material}
                i={c.i}
                showDrip={showDrip}
                showSpray={showSpray}
                dripFocus={selected === "drip"}
              />
            </button>
          )
        })}

        {/* Walkway + patio (hardscape laid over the ground) */}
        <PatioModel
          selected={selected === "patio"}
          dim={selected != null && selected !== "patio"}
          onSelect={(e) => {
            e.stopPropagation()
            setSelected((s) => (s === "patio" ? null : "patio"))
          }}
        />

        {/* Clay trees */}
        {TREES.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setSelected((s) => (s === "trees" ? null : "trees"))
            }}
            aria-label="Shade trees"
            aria-pressed={selected === "trees"}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-transform duration-500 focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: `${t.s}%`,
              height: `${t.s}%`,
              opacity: selected != null && selected !== "trees" ? 0.6 : 1,
              transform: `translate(-50%, -50%) scale(${selected === "trees" ? 1.08 : 1})`,
              zIndex: 6,
            }}
          >
            <span
              className={cn(
                "block size-full rounded-full",
                selected === "trees" && "ring-2 ring-white/80",
              )}
              style={{
                background: TREE,
                boxShadow:
                  "0 8px 14px rgba(60,80,40,0.35), inset 0 3px 6px rgba(255,255,255,0.25)",
              }}
            />
          </button>
        ))}

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
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
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
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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

      {/* Slider thumb + gentle-appear styles, matching the solar explorer's
          in-component style approach. */}
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

function isMaterial(id: ElementId): id is Material {
  return id === "lawn" || id === "planting" || id === "mulch" || id === "gravel"
}

// ---------------------------------------------------------------------------
// Per-tile decorations — shrubs, blooms, pebbles, drip emitters, spray arcs.
// ---------------------------------------------------------------------------
function CellDecor({
  material,
  i,
  showDrip,
  showSpray,
  dripFocus,
}: {
  material: Material
  i: number
  showDrip: boolean
  showSpray: boolean
  dripFocus: boolean
}) {
  if (material === "planting") {
    const shrubs = 2 + Math.floor(hash(i, 1) * 2) // 2-3 shrubs
    return (
      <span className="absolute inset-0">
        {Array.from({ length: shrubs }).map((_, n) => {
          const size = 26 + hash(i, n + 2) * 16
          return (
            <span
              key={n}
              className="absolute rounded-full"
              style={{
                width: `${size}%`,
                height: `${size}%`,
                left: `${14 + hash(i, n + 3) * 52}%`,
                top: `${14 + hash(i, n + 4) * 52}%`,
                background: SHRUB,
                boxShadow:
                  "0 3px 5px rgba(50,70,35,0.35), inset 0 2px 3px rgba(255,255,255,0.3)",
              }}
            />
          )
        })}
        {/* clay bloom */}
        {hash(i, 9) > 0.5 ? (
          <span
            className="absolute size-[10%] rounded-full"
            style={{
              left: `${30 + hash(i, 10) * 40}%`,
              top: `${30 + hash(i, 11) * 40}%`,
              background: BLOOM[Math.floor(hash(i, 12) * BLOOM.length)],
            }}
          />
        ) : null}
        {showDrip ? (
          <span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: dripFocus ? "18%" : "12%",
              height: dripFocus ? "18%" : "12%",
              background: "#5b9bd0",
              boxShadow: dripFocus
                ? "0 0 0 4px rgba(91,155,208,0.35)"
                : "0 0 0 2px rgba(91,155,208,0.25)",
              transition: "all 300ms",
            }}
          />
        ) : null}
      </span>
    )
  }

  if (material === "gravel") {
    const pebbles = 5 + Math.floor(hash(i, 1) * 3)
    return (
      <span className="absolute inset-0">
        {Array.from({ length: pebbles }).map((_, n) => (
          <span
            key={n}
            className="absolute rounded-full"
            style={{
              width: `${10 + hash(i, n + 2) * 10}%`,
              height: `${10 + hash(i, n + 3) * 10}%`,
              left: `${10 + hash(i, n + 4) * 74}%`,
              top: `${10 + hash(i, n + 5) * 74}%`,
              background: hash(i, n) > 0.5 ? "#b6a682" : "#cabd9c",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.4)",
            }}
          />
        ))}
      </span>
    )
  }

  if (material === "mulch") {
    return (
      <span className="absolute inset-0">
        {Array.from({ length: 5 }).map((_, n) => (
          <span
            key={n}
            className="absolute rounded-full opacity-70"
            style={{
              width: `${8 + hash(i, n + 2) * 8}%`,
              height: `${5 + hash(i, n + 3) * 4}%`,
              left: `${12 + hash(i, n + 4) * 70}%`,
              top: `${12 + hash(i, n + 5) * 70}%`,
              background: "#6f4529",
            }}
          />
        ))}
      </span>
    )
  }

  // lawn — optional spray head in a corner of some tiles
  if (showSpray && hash(i, 7) > 0.62) {
    return (
      <span
        className="absolute size-[42%] rounded-full"
        style={{
          right: "-6%",
          bottom: "-6%",
          background:
            "radial-gradient(circle at 100% 100%, rgba(91,155,208,0.5), rgba(91,155,208,0) 70%)",
        }}
      />
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// House — a simplified architectural clay footprint with a terracotta roof.
// ---------------------------------------------------------------------------
function HouseModel() {
  return (
    <div
      className="pointer-events-none absolute"
      style={{ left: "13%", top: "4%", width: "74%", height: "22%" }}
      aria-hidden="true"
    >
      {/* ground shadow */}
      <span className="absolute inset-x-4 bottom-0 h-4 rounded-full bg-[rgba(90,70,45,0.25)] blur-md" />
      {/* walls */}
      <span
        className="absolute inset-0 rounded-2xl"
        style={{
          background: "linear-gradient(165deg, #efe4cf 0%, #e0d0b3 100%)",
          boxShadow:
            "0 10px 18px rgba(90,70,45,0.22), inset 0 2px 4px rgba(255,255,255,0.55)",
        }}
      />
      {/* roof band */}
      <span
        className="absolute inset-x-0 top-0 h-1/2 rounded-2xl"
        style={{
          background: "linear-gradient(165deg, #cf8055 0%, #b1663f 100%)",
          boxShadow: "inset 0 3px 6px rgba(255,255,255,0.28)",
        }}
      />
      {/* ridge line */}
      <span className="absolute left-6 right-6 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[rgba(120,80,55,0.4)]" />
      {/* door */}
      <span
        className="absolute bottom-0 left-1/2 h-1/2 w-[12%] -translate-x-1/2 rounded-t-md"
        style={{ background: "#b1663f" }}
      />
      {/* windows */}
      <span className="absolute bottom-2 left-[24%] size-3 rounded-sm bg-[#cdbd9e]" />
      <span className="absolute bottom-2 right-[24%] size-3 rounded-sm bg-[#cdbd9e]" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Patio + walkway — stone hardscape laid over the ground near the house.
// ---------------------------------------------------------------------------
function PatioModel({
  selected,
  dim,
  onSelect,
}: {
  selected: boolean
  dim: boolean
  onSelect: (e: React.MouseEvent) => void
}) {
  return (
    <div
      className="absolute inset-0"
      style={{ opacity: dim ? 0.6 : 1, zIndex: selected ? 7 : 4 }}
    >
      {/* walkway strip from the door toward the patio */}
      <button
        type="button"
        onClick={onSelect}
        aria-label="Patio and walkway"
        aria-pressed={selected}
        className="absolute -translate-x-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ left: "34%", top: "26%", width: "7%", height: "16%" }}
      >
        <span
          className="block size-full rounded-full"
          style={{
            background: "linear-gradient(160deg, #ddd4c4 0%, #c7bdac 100%)",
            boxShadow: "0 2px 4px rgba(90,70,45,0.2)",
          }}
        />
      </button>
      {/* patio pad */}
      <button
        type="button"
        onClick={onSelect}
        aria-label="Patio and walkway"
        aria-pressed={selected}
        className="absolute -translate-x-1/2 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ left: "26%", top: "40%", width: "22%", height: "12%" }}
      >
        <span
          className={cn(
            "block size-full rounded-2xl",
            selected && "ring-2 ring-white/80",
          )}
          style={{
            background: "linear-gradient(160deg, #dcd3c3 0%, #c3b9a6 100%)",
            boxShadow:
              "0 5px 10px rgba(90,70,45,0.22), inset 0 2px 3px rgba(255,255,255,0.5)",
          }}
        />
        {/* paver seams */}
        <span className="pointer-events-none absolute inset-2 rounded-xl border border-[rgba(120,100,70,0.25)]" />
      </button>
    </div>
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
        highlight
          ? "border-primary/30 bg-primary/8"
          : "border-border bg-card",
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

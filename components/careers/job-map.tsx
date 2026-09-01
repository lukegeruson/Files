"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Banknote,
  Briefcase,
  CalendarDays,
  Clock,
  ExternalLink,
  GraduationCap,
  Info,
  Mail,
  MapPin,
  Maximize2,
  Minus,
  Plus,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { INDUSTRY_META } from "@/lib/careers/industries"
import type { Industry } from "@/lib/careers/types"
// Imports from `job-map-shared`, never `job-map`: the latter pulls d3-geo and
// the state atlas in, which must stay on the server.
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type Box,
  type JobPin,
  type StatePath,
} from "@/lib/careers/job-map-shared"

/**
 * Colour per trade, as requested: solar yellow, landscaping blue-green,
 * renovation orange, agriculture green. These are their own design tokens
 * rather than the --chart-* ramp because the map needs hue to survive dark
 * mode — see the note in globals.css.
 */
const PIN_VAR: Record<Industry, string> = {
  solar: "var(--job-solar)",
  landscaping: "var(--job-landscaping)",
  renovation: "var(--job-renovation)",
  agriculture: "var(--job-agriculture)",
}

/** Short labels for the toggles; INDUSTRY_META labels are too long for chips. */
const SHORT_LABEL: Record<Industry, string> = {
  solar: "Solar",
  landscaping: "Landscaping",
  renovation: "Renovation",
  agriculture: "Agriculture",
}

const ORDER: Industry[] = ["landscaping", "solar", "renovation", "agriculture"]

const ASPECT = MAP_WIDTH / MAP_HEIGHT
const MAX_ZOOM = 14
const FULL_VIEW: View = { x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT }

type View = { x: number; y: number; w: number; h: number }

/**
 * Keep the frame's centre over the map rather than the frame itself inside it.
 *
 * Hard-clamping to the map bounds shoves edge states like California or Maine
 * against the side of the viewport, because a 975x610 frame centred on them
 * necessarily extends past the coastline. Allowing the frame to overhang keeps
 * the searched state centred, and bounding the centre still stops you panning
 * off into empty space.
 */
function clampView(v: View): View {
  return {
    ...v,
    x: Math.max(-v.w / 2, Math.min(v.x, MAP_WIDTH - v.w / 2)),
    y: Math.max(-v.h / 2, Math.min(v.y, MAP_HEIGHT - v.h / 2)),
  }
}

/** Width-driven so the view always keeps the map's aspect ratio. */
function viewFromWidth(cx: number, cy: number, rawWidth: number): View {
  const w = Math.max(MAP_WIDTH / MAX_ZOOM, Math.min(rawWidth, MAP_WIDTH))
  const h = w / ASPECT
  return clampView({ x: cx - w / 2, y: cy - h / 2, w, h })
}

/**
 * Frame a state's bounding box with a little breathing room around it.
 *
 * The floor matters: small states like Rhode Island or Delaware would
 * otherwise open at 20x+, a claustrophobic view with no context around the
 * pins. Capping the initial zoom keeps neighbouring states visible so you can
 * tell where you are and pan outward.
 */
const MIN_STATE_VIEW_WIDTH = MAP_WIDTH / 4.5

function viewForBox(box: Box): View {
  const padded = Math.max(
    MIN_STATE_VIEW_WIDTH,
    Math.max(box.width, box.height * ASPECT) * 1.18,
  )
  return viewFromWidth(box.x + box.width / 2, box.y + box.height / 2, padded)
}

function zoomBy(v: View, factor: number): View {
  return viewFromWidth(v.x + v.w / 2, v.y + v.h / 2, v.w / factor)
}

export function JobMap({
  statePaths,
  stateBoxes,
  pins,
  zip,
  activeStateName,
  matchedCareerIds = [],
}: {
  statePaths: StatePath[]
  stateBoxes: Record<string, Box>
  pins: JobPin[]
  zip: string
  /** State the ZIP resolves to, or null when it falls outside the table. */
  activeStateName: string | null
  matchedCareerIds?: string[]
}) {
  const initialView = useMemo(() => {
    const box = activeStateName ? stateBoxes[activeStateName] : undefined
    return box ? viewForBox(box) : FULL_VIEW
  }, [activeStateName, stateBoxes])

  const [hidden, setHidden] = useState<Set<Industry>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<View>(initialView)

  // Re-frame when a new ZIP is submitted. Adjusting state during render on a
  // prop change is React's recommended alternative to a syncing effect.
  const [lastZip, setLastZip] = useState(zip)
  if (zip !== lastZip) {
    setLastZip(zip)
    setView(initialView)
    setSelected(null)
  }

  const matched = useMemo(() => new Set(matchedCareerIds), [matchedCareerIds])

  const counts = useMemo(() => {
    const out: Record<Industry, number> = {
      solar: 0,
      landscaping: 0,
      renovation: 0,
      agriculture: 0,
    }
    for (const p of pins) out[p.industry] += 1
    return out
  }, [pins])

  const visible = useMemo(
    () => pins.filter((p) => !hidden.has(p.industry)),
    [pins, hidden],
  )

  // SVG paints in document order, so whatever is rendered last sits on top and
  // wins the click. Sample employers are far more numerous and cluster in the
  // same cities, so in source order they can bury a real opening and make it
  // literally unclickable — the one pin on the map worth clicking. Live pins
  // therefore render last, and the selected pin last of all so its highlight is
  // never clipped by a neighbour.
  const painted = useMemo(() => {
    const weight = (p: JobPin) =>
      (p.source === "live" ? 1 : 0) + (p.id === selected ? 2 : 0)
    return visible.slice().sort((a, b) => weight(a) - weight(b))
  }, [visible, selected])

  // Pins actually inside the current frame, so the caption can be honest about
  // what you are looking at versus what exists nationally.
  const inFrame = useMemo(
    () =>
      visible.filter(
        (p) =>
          p.x >= view.x &&
          p.x <= view.x + view.w &&
          p.y >= view.y &&
          p.y <= view.y + view.h,
      ),
    [visible, view],
  )

  const selectedPin = useMemo(
    () => visible.find((p) => p.id === selected) ?? null,
    [visible, selected],
  )

  // Counted separately from the total. Conflating real openings with sample
  // ones in a single number is exactly the confusion the two pin styles exist
  // to prevent, so the caption and legend report them apart.
  const liveTotal = useMemo(
    () => visible.filter((p) => p.source === "live").length,
    [visible],
  )
  const liveInFrame = useMemo(
    () => inFrame.filter((p) => p.source === "live").length,
    [inFrame],
  )

  const zoom = MAP_WIDTH / view.w

  function toggle(industry: Industry) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(industry)) next.delete(industry)
      else next.add(industry)
      return next
    })
    setSelected(null)
  }

  // --- pan -----------------------------------------------------------------
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(
    null,
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return
      // Deliberately NOT capturing the pointer here. Pointer capture also
      // retargets the compatibility mouse events, so the closing `click` would
      // be delivered to this <svg> instead of the pin that was pressed — which
      // silently made every pin unclickable by mouse while keyboard activation
      // and synthetic events still worked. Capture is taken in onPointerMove
      // once the gesture is actually a drag.
      drag.current = { x: e.clientX, y: e.clientY, view, moved: false }
    },
    [view],
  )

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    const rect = svgRef.current?.getBoundingClientRect()
    if (!d || !rect) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      d.moved = true
      // Now that this is a real pan, capture so the gesture keeps tracking if
      // the cursor leaves the map. A click is no longer expected, so
      // retargeting it is harmless.
      svgRef.current?.setPointerCapture(e.pointerId)
    }
    if (!d.moved) return
    setView(
      clampView({
        ...d.view,
        x: d.view.x - (dx / rect.width) * d.view.w,
        y: d.view.y - (dy / rect.height) * d.view.h,
      }),
    )
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (svgRef.current?.hasPointerCapture(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId)
    }
    // Safe to clear: `markDragged` runs just before this and has already
    // snapshotted `moved` into draggedRef for the click that follows.
    drag.current = null
  }, [])

  /** Suppress the click that ends a drag, so panning never opens a popup. */
  const draggedRef = useRef(false)
  const markDragged = () => {
    draggedRef.current = Boolean(drag.current?.moved)
  }

  const scopeLabel = activeStateName ?? "the United States"

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape" && selected) setSelected(null)
      }}
    >
      {/* --- category toggles ------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Show
        </span>
        {ORDER.map((industry) => {
          const on = !hidden.has(industry)
          return (
            <button
              key={industry}
              type="button"
              onClick={() => toggle(industry)}
              aria-pressed={on}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
                on
                  ? "border-foreground/25 bg-card text-foreground"
                  : "border-border bg-transparent text-muted-foreground",
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/15"
                style={{
                  backgroundColor: on ? PIN_VAR[industry] : "transparent",
                  boxShadow: on ? "none" : `inset 0 0 0 1.5px ${PIN_VAR[industry]}`,
                }}
                aria-hidden="true"
              />
              {SHORT_LABEL[industry]}
              <span className="tabular-nums text-xs text-muted-foreground">
                {counts[industry]}
              </span>
              <span className="sr-only">{on ? "(showing)" : "(hidden)"}</span>
            </button>
          )
        })}
      </div>

      {/* Legend for the two pin styles. Only earns its space once real
          openings exist — with none posted, every pin is a sample and there is
          no distinction to explain. */}
      {liveTotal > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full bg-foreground"
              aria-hidden="true"
            />
            <span>
              <span className="font-medium text-foreground">Solid</span> — open
              role you can apply to
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full border-[1.5px] border-foreground bg-card"
              aria-hidden="true"
            />
            <span>
              <span className="font-medium text-foreground">Hollow</span> —
              sample employer, illustrative only
            </span>
          </span>
        </div>
      ) : null}

      {/* --- map -------------------------------------------------------- */}
      <div className="relative mt-4 overflow-hidden rounded-xl border border-border bg-secondary/30">
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          // min-height stops the map becoming a letterbox slot on narrow
          // screens; slice fills that taller box without distorting the
          // geography, showing a little more land instead of stretching it.
          preserveAspectRatio="xMidYMid slice"
          className="block aspect-[975/610] min-h-[26rem] w-full cursor-grab touch-none active:cursor-grabbing sm:min-h-0"
          role="group"
          aria-label={`Map of job openings in ${scopeLabel}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => {
            markDragged()
            onPointerUp(e)
          }}
          onPointerCancel={onPointerUp}
        >
          <g>
            {statePaths.map((s) => {
              const isActive = s.name === activeStateName
              return (
                <path
                  key={s.id}
                  d={s.d}
                  className={cn(
                    isActive ? "fill-background" : "fill-card",
                    "stroke-border",
                  )}
                  // non-scaling-stroke already holds the stroke constant in
                  // screen space, so this must NOT also be divided by zoom.
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
          </g>

          {/* Outline the searched state so the default framing is legible. */}
          {activeStateName
            ? statePaths
                .filter((s) => s.name === activeStateName)
                .map((s) => (
                  <path
                    key={`${s.id}-active`}
                    d={s.d}
                    fill="none"
                    className="stroke-primary"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                ))
            : null}

          <g>
            {painted.map((pin) => {
              const isSelected = pin.id === selectedPin?.id
              const isMatch = pin.careerId ? matched.has(pin.careerId) : false
              const isLive = pin.source === "live"
              // Real openings sit slightly larger so they read first at
              // national zoom, where a screen holds far more sample pins.
              const base = isLive ? 6.5 : 5
              const r = (isSelected ? base + 2 : base) / zoom
              return (
                <g
                  key={pin.id}
                  role="button"
                  tabIndex={0}
                  aria-label={[
                    // Leads with the distinction, because for a screen reader
                    // it is the difference between a job and an illustration.
                    isLive ? "Open role:" : "Sample role:",
                    `${pin.title} at ${pin.companyName},`,
                    `${pin.companyCity} ${pin.companyState}.`,
                    `${SHORT_LABEL[pin.industry]}.`,
                    pin.career ? `${pin.career.tierLabel}.` : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-pressed={isSelected}
                  className="cursor-pointer outline-none focus-visible:opacity-100"
                  onClick={() => {
                    if (draggedRef.current) return
                    setSelected(isSelected ? null : pin.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setSelected(isSelected ? null : pin.id)
                    }
                  }}
                >
                  {/* Generous invisible hit area — the dots are small when
                      zoomed out to the whole country. */}
                  <circle cx={pin.x} cy={pin.y} r={r * 2.1} fill="transparent" />
                  {/* Halo on real openings only. Gives them presence against a
                      field of samples without relying on colour, which is
                      already carrying the trade. */}
                  {isLive ? (
                    <circle
                      cx={pin.x}
                      cy={pin.y}
                      r={r * 2}
                      fill={PIN_VAR[pin.industry]}
                      opacity={0.18}
                    />
                  ) : null}
                  {isMatch ? (
                    <circle
                      cx={pin.x}
                      cy={pin.y}
                      r={r * 1.75}
                      fill="none"
                      className="stroke-foreground/40"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null}
                  {/* Solid means a real job; hollow means an illustration. The
                      shape carries it as well as the halo, so the distinction
                      survives a greyscale print or colour-blind viewing. */}
                  <circle
                    cx={pin.x}
                    cy={pin.y}
                    r={r}
                    fill={isLive ? PIN_VAR[pin.industry] : "var(--card)"}
                    stroke={isLive ? "var(--background)" : PIN_VAR[pin.industry]}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )
            })}
          </g>
        </svg>

        {/* --- zoom controls -------------------------------------------- */}
        <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-sm backdrop-blur">
          <ZoomButton
            label="Zoom in"
            onClick={() => setView((v) => zoomBy(v, 1.6))}
            disabled={zoom >= MAX_ZOOM - 0.01}
          >
            <Plus className="size-4" aria-hidden="true" />
          </ZoomButton>
          <ZoomButton
            label="Zoom out"
            onClick={() => setView((v) => zoomBy(v, 1 / 1.6))}
            disabled={zoom <= 1.01}
          >
            <Minus className="size-4" aria-hidden="true" />
          </ZoomButton>
          <div className="mx-1 border-t border-border" />
          {activeStateName && stateBoxes[activeStateName] ? (
            <ZoomButton
              label={`Zoom to ${activeStateName}`}
              onClick={() => setView(viewForBox(stateBoxes[activeStateName]))}
            >
              {/* An icon, not a truncated name: slicing "Texas" gives "TE". */}
              <MapPin className="size-4" aria-hidden="true" />
            </ZoomButton>
          ) : null}
          <ZoomButton
            label="Zoom out to the whole country"
            onClick={() => setView(FULL_VIEW)}
            disabled={zoom <= 1.01}
          >
            <Maximize2 className="size-4" aria-hidden="true" />
          </ZoomButton>
        </div>

        {/* --- popup ---------------------------------------------------- */}
        {selectedPin ? (
          <JobPopup
            pin={selectedPin}
            view={view}
            isMatch={
              selectedPin.careerId ? matched.has(selectedPin.careerId) : false
            }
            onClose={() => setSelected(null)}
          />
        ) : null}

        {/* Empty frame is a dead end without a way out, so offer one. */}
        {inFrame.length === 0 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4">
            <p className="pointer-events-auto rounded-lg border border-border bg-card/95 px-4 py-2.5 text-sm text-muted-foreground shadow-sm backdrop-blur">
              Nothing in view.{" "}
              <button
                type="button"
                onClick={() => setView(FULL_VIEW)}
                className="font-medium text-primary hover:underline"
              >
                See the whole country
              </button>
            </p>
          </div>
        ) : null}
      </div>

      {/* --- caption --------------------------------------------------- */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <p className="inline-flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Showing{" "}
            <span className="font-medium text-foreground">{inFrame.length}</span>{" "}
            of {pins.length} pins
            {liveTotal > 0 ? (
              <>
                , including{" "}
                <span className="font-medium text-foreground">
                  {liveInFrame} of {liveTotal}
                </span>{" "}
                open {liveTotal === 1 ? "role" : "roles"}
              </>
            ) : null}
            . Drag to pan, click a pin for details.
          </span>
        </p>
        <p aria-live="polite" className="text-sm tabular-nums text-muted-foreground">
          {zoom < 1.05 ? "Whole country" : `${zoom.toFixed(1)}× zoom`}
        </p>
      </div>
    </div>
  )
}

function ZoomButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  )
}

/**
 * Detail card anchored to the pin.
 *
 * Flips to the opposite side once the pin passes the midpoint of the frame so
 * the card stays inside the map instead of being clipped at the edge.
 */
function JobPopup({
  pin,
  view,
  isMatch,
  onClose,
}: {
  pin: JobPin
  view: View
  isMatch: boolean
  onClose: () => void
}) {
  const left = ((pin.x - view.x) / view.w) * 100
  const top = ((pin.y - view.y) / view.h) * 100
  const flipX = left > 55

  const rootRef = useRef<HTMLDivElement>(null)
  const [frameH, setFrameH] = useState(0)

  // The map frame is overflow-hidden, so a card taller than the space below
  // its pin gets silently sliced. Measuring the frame lets the card both flip
  // to the roomier side and cap itself to what actually fits, which a fixed
  // percentage threshold cannot do once the card height varies.
  useEffect(() => {
    const frame = rootRef.current?.offsetParent as HTMLElement | undefined
    if (!frame) return
    const measure = () => setFrameH(frame.clientHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(frame)
    return () => ro.disconnect()
  }, [])

  const GAP = 12
  const anchorY = (top / 100) * frameH
  const spaceBelow = frameH - anchorY - GAP
  const spaceAbove = anchorY - GAP
  // Prefer below while it can hold a readable card, else take the roomier side.
  const flipY = frameH > 0 && spaceBelow < 260 && spaceAbove > spaceBelow
  const availableH = flipY ? spaceAbove : spaceBelow

  // Longer roles still overflow on short viewports. Without a cue the clipped
  // line just looks like a rendering bug, so fade the bottom edge while there
  // is more to reach and drop the fade once you hit the end.
  const scrollRef = useRef<HTMLDivElement>(null)
  const [moreBelow, setMoreBelow] = useState(false)

  const syncScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }, [])

  // Runs on mount and whenever the pin changes, since each role has a
  // different amount of copy.
  useEffect(syncScroll, [syncScroll, pin.id])

  return (
    <div
      // Docked to the bottom on mobile, anchored to the pin from `sm` up. On a
      // phone an anchored card covers the pin it describes and the zoom
      // controls, so the position is driven by a media query rather than being
      // forced inline at every breakpoint.
      ref={rootRef}
      className="job-map-popup absolute inset-x-3 bottom-3 z-10 sm:inset-x-auto sm:bottom-auto sm:w-[19rem]"
      style={
        {
          "--pin-left": `${left}%`,
          "--pin-top": `${top}%`,
          "--pin-shift-x": flipX ? "calc(-100% - 0.75rem)" : "0.75rem",
          "--pin-shift-y": flipY ? "calc(-100% - 0.75rem)" : "0.75rem",
          "--pin-max-h": availableH > 0 ? `${availableH}px` : "21rem",
        } as React.CSSProperties
      }
      role="dialog"
      aria-label={`${pin.title} at ${pin.companyName}`}
    >
      {/* Header and footer are pinned and only the middle scrolls, so the
          employer and the "see the full role" link never get cut off.
          Anchored to a pin the ceiling is whichever is smaller: the 27rem
          design cap (21rem bought room for ~94px of detail that used to be
          cut mid-sentence) or the space actually left in the frame. */}
      <div className="flex max-h-[15rem] flex-col rounded-xl border border-border bg-card shadow-lg sm:max-h-[min(27rem,var(--pin-max-h))]">
        <div className="flex items-start justify-between gap-2 p-4 pb-0">
          <div className="min-w-0">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              // Colour repeats the toggle, but the trade is always named too.
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: PIN_VAR[pin.industry] }}
                aria-hidden="true"
              />
              {INDUSTRY_META[pin.industry].label}
            </span>
            <h4 className="mt-1 font-serif text-base font-semibold leading-snug">
              {pin.title}
            </h4>
            {/* Stated outright at the top of the card. The pin style already
                encodes it, but nobody should have to decode a legend to learn
                whether a job is real. */}
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                pin.source === "live" ? "text-primary" : "text-muted-foreground",
              )}
            >
              {pin.source === "live" ? "Open role" : "Sample employer"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* The scroll container must be the flex child itself. Wrapping it and
            using h-100% on the inner element let the content dictate the
            height, so the card clipped instead of scrolling. */}
        <div
          ref={scrollRef}
          onScroll={syncScroll}
          className="min-h-0 flex-1 overflow-y-auto px-4 pb-1"
        >
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {/* Tier and level come from the career library, so they only appear
              when this role is actually mapped to one. */}
          {pin.career ? (
            <>
              <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                {pin.career.tierLabel}
              </span>
              {pin.career.tierLabel !== pin.career.levelLabel ? (
                <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {pin.career.levelLabel}
                </span>
              ) : null}
            </>
          ) : null}
          {isMatch ? (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Matches you
            </span>
          ) : null}
        </div>

        {pin.description ? (
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            {pin.description}
          </p>
        ) : null}

        {/* Facts about this specific opening, which only a real posting has.
            Listed above the career detail because pay and hours are what
            someone deciding whether to apply reads first. */}
        {pin.posting ? (
          <dl className="mt-3 flex flex-col gap-1.5 text-xs">
            {pin.posting.payLabel ? (
              <div className="flex items-start gap-1.5">
                <Banknote
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <dt className="sr-only">Pay</dt>
                <dd className="font-medium text-foreground">
                  {pin.posting.payLabel}
                </dd>
              </div>
            ) : null}
            <div className="flex items-start gap-1.5">
              <Briefcase
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <dt className="sr-only">Employment type</dt>
              <dd className="text-muted-foreground">
                {pin.posting.employmentLabel}
              </dd>
            </div>
            <div className="flex items-start gap-1.5">
              <CalendarDays
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <dt className="sr-only">Dates</dt>
              <dd className="text-muted-foreground">
                Posted {pin.posting.postedLabel}
                {pin.posting.closesLabel
                  ? ` · closes ${pin.posting.closesLabel}`
                  : ""}
              </dd>
            </div>
          </dl>
        ) : null}

        {pin.career ? (
          <dl className="mt-3 flex flex-col gap-1.5 text-xs">
            <div className="flex items-start gap-1.5">
              <GraduationCap
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <dt className="sr-only">Experience needed</dt>
              <dd className="text-muted-foreground">
                {pin.career.experienceRequired === "None"
                  ? "No experience needed"
                  : `${pin.career.experienceRequired} experience`}
              </dd>
            </div>
            <div className="flex items-start gap-1.5">
              <Clock
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <dt className="sr-only">Training time</dt>
              <dd className="text-muted-foreground">{pin.career.trainingTime}</dd>
            </div>
          </dl>
        ) : null}

      {/* Guarded on the list, not just the career: a career with no skills
          recorded would otherwise render this heading over empty space. */}
      {pin.career && pin.career.skills.length > 0 ? (
        <div className="mt-3">
          <h5 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Skills you would use
          </h5>
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {pin.career.skills.map((skill) => (
                <li
                  key={skill}
                  className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          /* Says what is missing and why, rather than leaving a conspicuously
             thin card. Guessing a tier or skill list from the job title would
             be inventing the very information this panel is trusted for. */
          <p className="mt-3 rounded-lg bg-secondary/60 p-2.5 text-xs leading-relaxed text-muted-foreground">
            This role isn&apos;t matched to an entry in our career library, so
            there is no training path or skill breakdown for it here. The
            employer&apos;s own listing has the full requirements.
          </p>
        )}

        </div>

        {/* The fade hangs off the top of the footer rather than living inside
            the scroll area, where it would scroll away with the content. */}
        <div className="relative shrink-0 border-t border-border p-4 pt-3">
          {moreBelow ? (
            <div
              className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-card to-transparent"
              aria-hidden="true"
            />
          ) : null}
          <p className="text-sm font-medium">{pin.companyName}</p>
          <p className="text-xs text-muted-foreground">
            {pin.companyCity}, {pin.companyState}
            {pin.companySize ? ` · ${pin.companySize}` : ""}
          </p>

          {/* A real opening gets the apply action as its primary CTA; a sample
              gets no action at all, because there is nothing to apply to. */}
          {pin.posting ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              {pin.posting.applyUrl ? (
                <a
                  href={pin.posting.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Apply
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : pin.posting.applyEmail ? (
                <a
                  href={`mailto:${pin.posting.applyEmail}?subject=${encodeURIComponent(
                    `Application: ${pin.title}`,
                  )}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Apply by email
                  <Mail className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
              {pin.careerId ? (
                <Link
                  href={`/jobs/careers/${pin.careerId}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  About this role
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          ) : pin.careerId ? (
            <Link
              href={`/jobs/careers/${pin.careerId}`}
              className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              See the full role
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}

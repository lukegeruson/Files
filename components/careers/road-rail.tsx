"use client"

import { useEffect, useRef } from "react"

/** Height of the vehicle chip in px. Kept in JS because the travel maths needs it. */
const VEHICLE_SIZE = 30

/** Only attach scroll work once the rail is actually rendered. */
const RAIL_MQ = "(min-width: 1024px)"

/**
 * Top-down car, nose pointing down the road so it faces its direction of
 * travel. Lucide has no overhead car — `Car` and `CarFront` are both elevation
 * views — so this is a hand-rolled glyph, kept to flat rects and one path to
 * stay legible at 16px.
 *
 * The glass is filled with `--primary` rather than left transparent because the
 * chip behind it is `bg-primary`; painting it explicitly avoids an `evenodd`
 * hole that would show whatever sits underneath if the chip colour changes.
 */
function CarOverhead({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Wheels, sitting just proud of the body on both sides. */}
      <g fill="currentColor" opacity="0.85">
        <rect x="5.9" y="5.2" width="1.9" height="3.7" rx="0.8" />
        <rect x="16.2" y="5.2" width="1.9" height="3.7" rx="0.8" />
        <rect x="5.9" y="15.1" width="1.9" height="3.7" rx="0.8" />
        <rect x="16.2" y="15.1" width="1.9" height="3.7" rx="0.8" />
      </g>
      {/* Body. */}
      <rect x="7.5" y="2.5" width="9" height="19" rx="2.6" fill="currentColor" />
      {/* Windscreen (nose end) and rear window. */}
      <rect x="9.1" y="15" width="5.8" height="2.5" rx="0.9" fill="var(--primary)" />
      <rect x="9.1" y="6.3" width="5.8" height="2.3" rx="0.9" fill="var(--primary)" />
    </svg>
  )
}

/**
 * Top-down aircraft, also nose-down. Drawn pointing up and flipped with a
 * single `rotate` so the silhouette maths stays readable.
 */
function PlaneOverhead({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        transform="rotate(180 12 12)"
        fill="currentColor"
        d="M12 1.6c.92 0 1.6 1.1 1.6 2.7v4.9l8.4 4.2v1.9l-8.4-1.7v4.8l3.4 2.2v1.4L12 20.8l-5 1.2v-1.4l3.4-2.2v-4.8L2 15.3v-1.9l8.4-4.2V4.3c0-1.6.68-2.7 1.6-2.7Z"
      />
    </svg>
  )
}

/**
 * Vertical road that runs alongside the result groups, with a vehicle that
 * tracks scroll position and swaps to an aircraft once it crosses into the
 * out-of-state band — you would not drive that leg.
 *
 * Cost control is the whole design here:
 * - The asphalt and the lane dashes are two CSS gradients, not per-dash DOM.
 * - Scroll updates never touch React state. They write `transform` straight to
 *   the vehicle node, so nothing re-renders and no child reconciles.
 * - Work is coalesced to one rAF per frame and reads a single rect, so a burst
 *   of scroll events collapses into one read and one composited write.
 * - Both glyphs are mounted once and toggled with `display`, and only on the
 *   frame the threshold is actually crossed.
 * - Below `lg` the rail is not rendered and the listeners are never attached.
 */
export function RoadRail({ segmentCount }: { segmentCount: number }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const vehicleRef = useRef<HTMLDivElement>(null)
  const carRef = useRef<HTMLSpanElement>(null)
  const planeRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const track = trackRef.current
    const vehicle = vehicleRef.current
    const carIcon = carRef.current
    const planeIcon = planeRef.current
    if (!track || !vehicle || !carIcon || !planeIcon) return

    const mq = window.matchMedia(RAIL_MQ)
    let frame = 0
    let attached = false
    // Offset down the track where driving gives way to flying, and the last
    // value written, so the swap only touches the DOM when it actually flips.
    let flightOffset: number | null = null
    let flying: boolean | null = null

    // Measured on attach and resize rather than per frame: the band heights
    // only change on layout, so this keeps the scroll path to one rect read.
    const measureFlightOffset = () => {
      const marker = track.parentElement?.querySelector("[data-flight-marker]")
      if (!marker) {
        flightOffset = null
        return
      }
      flightOffset =
        marker.getBoundingClientRect().top - track.getBoundingClientRect().top
    }

    const update = () => {
      frame = 0
      const rect = track.getBoundingClientRect()
      const travel = rect.height - VEHICLE_SIZE
      if (travel <= 0) return
      // Progress of the viewport's midline through the track: 0 as the list
      // arrives, 1 once its end has passed the middle of the screen.
      const raw = (window.innerHeight * 0.5 - rect.top) / rect.height
      const progress = raw < 0 ? 0 : raw > 1 ? 1 : raw
      const offset = progress * travel
      vehicle.style.transform = `translate3d(-50%, ${offset}px, 0)`

      const shouldFly = flightOffset !== null && offset >= flightOffset
      if (shouldFly !== flying) {
        flying = shouldFly
        carIcon.style.display = shouldFly ? "none" : "contents"
        planeIcon.style.display = shouldFly ? "contents" : "none"
      }
    }

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update)
    }

    const onResize = () => {
      measureFlightOffset()
      onScroll()
    }

    const attach = () => {
      if (attached) return
      attached = true
      measureFlightOffset()
      update()
      window.addEventListener("scroll", onScroll, { passive: true })
      window.addEventListener("resize", onResize, { passive: true })
    }

    const detach = () => {
      if (!attached) return
      attached = false
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
    }

    const sync = () => (mq.matches ? attach() : detach())
    sync()
    mq.addEventListener("change", sync)

    return () => {
      mq.removeEventListener("change", sync)
      detach()
      if (frame) cancelAnimationFrame(frame)
    }
    // Re-measure when the number of bands changes, since the track resizes.
  }, [segmentCount])

  return (
    <div
      ref={trackRef}
      // Decorative: the band headings already carry this grouping in text.
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 hidden w-20 lg:block"
    >
      {/* Asphalt, with shoulder lines on the edges so it reads as a surface
          rather than a stray rule. */}
      <div className="absolute inset-y-0 left-1/2 w-9 -translate-x-1/2 border-x border-border bg-secondary" />

      {/* Lane dashes: one repeating gradient for the whole run. */}
      <div
        className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, var(--primary) 0 14px, transparent 14px 34px)",
        }}
      />

      <div
        ref={vehicleRef}
        className="absolute left-1/2 top-0 grid place-items-center rounded-full bg-primary shadow-sm ring-2 ring-background"
        style={{
          width: VEHICLE_SIZE,
          height: VEHICLE_SIZE,
          // Matches the initial transform so there is no first-paint jump.
          transform: "translate3d(-50%, 0, 0)",
        }}
      >
        {/* `contents` keeps the grid centring on the svg itself, so the wrapper
            span adds no box of its own. */}
        <span ref={carRef} style={{ display: "contents" }}>
          <CarOverhead className="size-4 text-primary-foreground" />
        </span>
        <span ref={planeRef} style={{ display: "none" }}>
          <PlaneOverhead className="size-4 text-primary-foreground" />
        </span>
      </div>
    </div>
  )
}

/**
 * Distance marker sitting at the top of a band's stretch of road.
 *
 * `flight` tags the band where the vehicle should be airborne; the rail reads
 * the resulting attribute to find its switch point.
 */
export function RoadMarker({
  distance,
  flight = false,
}: {
  distance: string
  flight?: boolean
}) {
  return (
    <div
      aria-hidden="true"
      data-flight-marker={flight ? "true" : undefined}
      className="absolute left-0 top-0 hidden w-20 justify-center lg:flex"
    >
      <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
        {distance}
      </span>
    </div>
  )
}

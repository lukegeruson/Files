"use client"

import { useEffect, useState } from "react"

/**
 * A small clay "skill tree" illustration for the Jobs hero.
 *
 * This is a decorative illustration, not the interactive data explorer in
 * `skill-tree.tsx`. To match the visual simulators elsewhere on the site
 * (solar, landscaping, renovation, agriculture), it uses the same language:
 * real clay-rendered PNG dioramas on a flat cream panel with a rounded border,
 * crossfading between stages exactly like those tools crossfade their renders.
 *
 * Here the crossfade tells the page's story — "Build your skill tree" — by
 * growing a sculpted clay tree from a two-leaf sprout, to a three-branch
 * sapling, to a full canopy tipped with the four industry accent colors, then
 * gently dissolving back to the sprout to loop.
 */

const STAGES = [
  "/careers-styles/tree-stage-1.png",
  "/careers-styles/tree-stage-2.png",
  "/careers-styles/tree-stage-3.png",
] as const

// How long each stage holds before crossfading to the next. The full tree
// (last) lingers a little longer so the "finished" state reads clearly.
const HOLD_MS = [1900, 1900, 2600]

export function ClaySkillTree({ className }: { className?: string }) {
  const [stage, setStage] = useState(0)
  const [animate, setAnimate] = useState(true)

  useEffect(() => {
    // Honor reduced-motion: hold on the full tree, no looping crossfade.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mq.matches) {
      setAnimate(false)
      setStage(STAGES.length - 1)
      return
    }

    let timeout: ReturnType<typeof setTimeout>
    const schedule = (current: number) => {
      timeout = setTimeout(() => {
        setStage((s) => {
          const next = (s + 1) % STAGES.length
          schedule(next)
          return next
        })
      }, HOLD_MS[current])
    }
    schedule(0)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div
      className={className}
      role="img"
      aria-label="A clay sculpture of a skill tree growing from a small sprout into a full tree tipped with colored buds for each trade industry."
    >
      {/* Same framed cream panel the visual simulators use, so the hero
          illustration reads as a miniature clay simulator. The renders share
          this exact cream, so the square blends into the panel seamlessly. */}
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl border border-[#e4d9c2] bg-[#f2e9d7]">
        {STAGES.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src || "/placeholder.svg"}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 size-full object-contain transition-opacity duration-700 ease-in-out"
            style={{
              opacity: i === stage ? 1 : 0,
              filter: "drop-shadow(0 16px 20px rgba(90,60,25,0.20))",
            }}
            crossOrigin="anonymous"
          />
        ))}

        {/* Growth progress dots, echoing the simulators' stage ticks. */}
        {animate && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {STAGES.map((src, i) => (
              <span
                key={src}
                className="size-1.5 rounded-full transition-colors duration-500"
                style={{
                  background: i === stage ? "var(--primary)" : "#d8cbb0",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useId, useState } from "react"

/**
 * A small, decorative "clay sculpture" of a skill tree for the Jobs hero.
 *
 * This is a visual illustration, not the interactive data explorer in
 * `skill-tree.tsx`. It is built entirely from SVG so it stays lightweight and
 * responsive: inflated node bodies use radial gradients for a soft 3D clay
 * look, branches are rounded tube strokes, and everything sits on a soft
 * ambient shadow. Interaction is deliberately minimal — nodes gently scale and
 * brighten on hover and their branch highlights — matching the site's quiet,
 * tactile clay language rather than a heavy 3D scene.
 */

type ClayColor = "career" | "solar" | "landscaping" | "renovation" | "agriculture"

/** Each palette is a light/base/dark trio so the radial gradient reads as a
 *  rounded, side-lit lump of clay rather than a flat disc. */
const PALETTES: Record<ClayColor, { light: string; base: string; dark: string }> = {
  career: { light: "#f0c99a", base: "#d98b4a", dark: "#b4692f" },
  solar: { light: "#f6d98a", base: "#e6b84f", dark: "#c9963a" },
  landscaping: { light: "#8fd6cf", base: "#4fb3a8", dark: "#3a8f86" },
  renovation: { light: "#f4b48a", base: "#e08a52", dark: "#c26a37" },
  agriculture: { light: "#a6d69a", base: "#6fb45f", dark: "#548f47" },
}

type NodeSpec = {
  id: string
  x: number
  y: number
  r: number
  color: ClayColor
}

type BranchSpec = {
  id: string
  /** SVG path connecting two node centers, drawn as a rounded clay tube. */
  d: string
  /** Node ids this branch touches, so hovering a node lights its branches. */
  from: string
  to: string
  width: number
}

/**
 * Hand-tuned layout on a 320x360 canvas. It grows upward from one big Career
 * root, into three main branch hubs, then out to smaller skill buds. Positions
 * are intentionally a little irregular so it reads as organic clay, not a
 * generated graph.
 */
const NODES: NodeSpec[] = [
  { id: "career", x: 160, y: 312, r: 34, color: "career" },

  // main branch hubs
  { id: "hub-l", x: 84, y: 214, r: 21, color: "landscaping" },
  { id: "hub-m", x: 176, y: 196, r: 22, color: "renovation" },
  { id: "hub-r", x: 250, y: 226, r: 20, color: "agriculture" },

  // buds off the left hub
  { id: "bud-l1", x: 46, y: 130, r: 14, color: "landscaping" },
  { id: "bud-l2", x: 104, y: 118, r: 13, color: "solar" },

  // buds off the middle hub
  { id: "bud-m1", x: 158, y: 96, r: 15, color: "renovation" },
  { id: "bud-m2", x: 214, y: 112, r: 13, color: "solar" },
  { id: "bud-m3", x: 176, y: 44, r: 11, color: "agriculture" },

  // buds off the right hub
  { id: "bud-r1", x: 288, y: 150, r: 13, color: "agriculture" },
  { id: "bud-r2", x: 264, y: 300, r: 14, color: "solar" },
]

const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<string, NodeSpec>

/** Quadratic curve between two nodes with a little sideways bow, so branches
 *  arc like sculpted clay rather than running straight. */
function curve(fromId: string, toId: string, bow: number): string {
  const a = NODE_BY_ID[fromId]
  const b = NODE_BY_ID[toId]
  const mx = (a.x + b.x) / 2 + bow
  const my = (a.y + b.y) / 2
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`
}

const BRANCHES: BranchSpec[] = [
  { id: "b-cl", from: "career", to: "hub-l", d: curve("career", "hub-l", -18), width: 15 },
  { id: "b-cm", from: "career", to: "hub-m", d: curve("career", "hub-m", 6), width: 16 },
  { id: "b-cr", from: "career", to: "hub-r", d: curve("career", "hub-r", 16), width: 15 },

  { id: "b-l1", from: "hub-l", to: "bud-l1", d: curve("hub-l", "bud-l1", -12), width: 10 },
  { id: "b-l2", from: "hub-l", to: "bud-l2", d: curve("hub-l", "bud-l2", 8), width: 10 },

  { id: "b-m1", from: "hub-m", to: "bud-m1", d: curve("hub-m", "bud-m1", -8), width: 11 },
  { id: "b-m2", from: "hub-m", to: "bud-m2", d: curve("hub-m", "bud-m2", 10), width: 10 },
  { id: "b-m3", from: "bud-m1", to: "bud-m3", d: curve("bud-m1", "bud-m3", 6), width: 8 },

  { id: "b-r1", from: "hub-r", to: "bud-r1", d: curve("hub-r", "bud-r1", 12), width: 9 },
  { id: "b-r2", from: "hub-r", to: "bud-r2", d: curve("hub-r", "bud-r2", 10), width: 9 },
]

export function ClaySkillTree({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "")
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div
      className={className}
      // The whole sculpture breathes with a very slow idle float.
      style={{ animation: "clay-float 7s ease-in-out infinite" }}
    >
      <svg
        viewBox="0 0 320 360"
        className="h-auto w-full"
        role="img"
        aria-label="A clay sculpture of a skill tree: one large Career node at the base branching upward into smaller skill nodes."
      >
        <defs>
          {/* One radial gradient per color, offset toward the top-left so the
              light appears to come from a soft studio source. */}
          {(Object.keys(PALETTES) as ClayColor[]).map((c) => {
            const p = PALETTES[c]
            return (
              <radialGradient
                key={c}
                id={`${uid}-grad-${c}`}
                cx="38%"
                cy="32%"
                r="72%"
              >
                <stop offset="0%" stopColor={p.light} />
                <stop offset="55%" stopColor={p.base} />
                <stop offset="100%" stopColor={p.dark} />
              </radialGradient>
            )
          })}

          {/* Soft ambient shadow under every clay body. */}
          <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="4"
              floodColor="#7a4a22"
              floodOpacity="0.18"
            />
          </filter>

          {/* Faint clay grain: low-frequency noise nudged over the fill to add
              subtle surface imperfection without any sharp texture. */}
          <filter id={`${uid}-grain`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.05 0" />
            <feComposite operator="in" in2="SourceGraphic" />
          </filter>
        </defs>

        {/* Ground shadow: a single soft ellipse grounds the whole sculpture. */}
        <ellipse cx="162" cy="344" rx="96" ry="14" fill="#7a4a22" opacity="0.1" />

        {/* Branches first so nodes sit on top of their joints. */}
        <g fill="none" strokeLinecap="round">
          {BRANCHES.map((br) => {
            const lit = hovered != null && (hovered === br.from || hovered === br.to)
            const tone = PALETTES[NODE_BY_ID[br.to].color]
            return (
              <path
                key={br.id}
                d={br.d}
                stroke={lit ? tone.base : "#cda678"}
                strokeWidth={br.width}
                filter={`url(#${uid}-soft)`}
                style={{
                  opacity: lit ? 1 : 0.85,
                  transition: "stroke 240ms ease, opacity 240ms ease",
                }}
              />
            )
          })}
        </g>

        {/* Nodes. Each is a filled clay body with a small offset highlight blob
            for the inflated sheen, scaled up slightly on hover. */}
        {NODES.map((n) => {
          const isHover = hovered === n.id
          const scale = isHover ? 1.08 : 1
          return (
            <g
              key={n.id}
              tabIndex={0}
              role="presentation"
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(n.id)}
              onBlur={() => setHovered(null)}
              style={{
                transformOrigin: `${n.x}px ${n.y}px`,
                transform: `scale(${scale})`,
                transition: "transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                cursor: "default",
                outline: "none",
              }}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={`url(#${uid}-grad-${n.color})`}
                filter={`url(#${uid}-soft)`}
                style={{
                  filter: isHover ? "brightness(1.08)" : undefined,
                }}
              />
              {/* grain overlay, clipped to the same circle */}
              <circle cx={n.x} cy={n.y} r={n.r} fill="#000" filter={`url(#${uid}-grain)`} />
              {/* soft top-left sheen */}
              <ellipse
                cx={n.x - n.r * 0.3}
                cy={n.y - n.r * 0.34}
                rx={n.r * 0.42}
                ry={n.r * 0.3}
                fill="#ffffff"
                opacity={isHover ? 0.5 : 0.38}
                style={{ transition: "opacity 240ms ease" }}
              />
            </g>
          )
        })}
      </svg>

      <style jsx>{`
        @keyframes clay-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          div {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Calculator, Ruler } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LandscapeCostCalculator } from "@/components/landscape-cost-calculator"
import { LandscapeMaterialsCalculator } from "@/components/landscape-materials-calculator"
import { JumpToPostsLink } from "@/components/jump-to-posts-link"
import { LandscapeExplorer } from "@/components/landscape/landscape-explorer"
import { QuoteCapture } from "@/components/quote-capture"

type ToolId = "cost" | "materials"

const TOOLS: Array<{ id: ToolId; label: string; icon: React.ReactNode }> = [
  {
    id: "cost",
    label: "Landscape Cost",
    icon: <Calculator className="size-4" aria-hidden="true" />,
  },
  {
    id: "materials",
    label: "Materials Calculator",
    icon: <Ruler className="size-4" aria-hidden="true" />,
  },
]

/**
 * Deep-link targets so articles can point a reader at one specific tool, e.g.
 * `/landscaping#landscape-materials-calculator`.
 *
 * These hashes intentionally do not match a real element id: only one tool is
 * mounted at a time, so the browser cannot scroll to the inactive one. The
 * effect below selects the requested tool and then scrolls, which also keeps a
 * single scroll anchor (`#landscaping-calculators`) for the section as a whole.
 */
const TOOL_HASHES: Record<string, ToolId> = {
  "landscaping-calculators": "cost",
  "landscape-cost-calculator": "cost",
  "landscape-materials-calculator": "materials",
}

const COVERS: Record<
  ToolId,
  { title: string; description: string; icon: React.ReactNode; firstFieldId: string }
> = {
  cost: {
    title: "What will your landscaping project cost?",
    description:
      "Pick your yard features and size to see a local price range for materials, labor, and extras.",
    icon: <Calculator className="size-6" aria-hidden="true" />,
    firstFieldId: "lc-zip",
  },
  materials: {
    title: "How much material do you need?",
    description:
      "Enter your area and depth to see how much mulch, soil, gravel, sod, or plants to order.",
    icon: <Ruler className="size-6" aria-hidden="true" />,
    firstFieldId: "mat-zip",
  },
}

function ToolCover({ tool, onStart }: { tool: ToolId; onStart: () => void }) {
  const cover = COVERS[tool]
  return (
    <div className="flex flex-col items-center gap-5 rounded-lg border border-border bg-card px-6 py-16 text-center md:py-20">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-foreground">
        {cover.icon}
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-balance font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          {cover.title}
        </h2>
        <p className="text-pretty leading-relaxed text-muted-foreground">{cover.description}</p>
      </div>
      <Button size="lg" onClick={onStart} className="rounded-full px-8">
        Start
        <ArrowRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

export function LandscapingTools() {
  const [active, setActive] = useState<ToolId>("cost")
  const [started, setStarted] = useState<Record<ToolId, boolean>>({
    cost: false,
    materials: false,
  })
  const containerRef = useRef<HTMLDivElement>(null)

  function startTool(tool: ToolId) {
    setStarted((prev) => ({ ...prev, [tool]: true }))
    requestAnimationFrame(() => document.getElementById(COVERS[tool].firstFieldId)?.focus())
  }

  useEffect(() => {
    function applyHash() {
      const hash = window.location.hash.replace(/^#/, "")
      const tool = TOOL_HASHES[hash]
      if (!tool) return
      setActive(tool)
      // A direct link to a specific calculator skips its start cover.
      if (hash !== "landscaping-calculators") setStarted((prev) => ({ ...prev, [tool]: true }))
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    applyHash()
    // Also handle in-page hash changes, where React would not remount.
    window.addEventListener("hashchange", applyHash)
    return () => window.removeEventListener("hashchange", applyHash)
  }, [])

  return (
    <div
      ref={containerRef}
      id="landscaping-calculators"
      className="flex scroll-mt-24 flex-col gap-6"
    >
      {/* Interactive clay-model yard sits above the calculators, the landscaping
          counterpart to the solar explorer. */}
      <LandscapeExplorer />

      {/* Lead capture sits directly beneath the Visual Explorer. */}
      <QuoteCapture category="landscaping" />

      {/* Tool switcher — additional landscaping calculators slot in here. */}
      <div
        id="landscaping-calculator-tools"
        className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          role="tablist"
          aria-label="Landscaping calculators"
          className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
        >
          {TOOLS.map((tool) => {
            const isActive = tool.id === active
            return (
              <button
                key={tool.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`landscaping-tool-${tool.id}`}
                id={`landscaping-tab-${tool.id}`}
                onClick={() => setActive(tool.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm transition-colors",
                  isActive
                    ? "border-primary bg-primary/15 font-medium text-foreground"
                    : "border-input bg-background text-muted-foreground hover:border-ring hover:text-foreground",
                )}
              >
                {tool.icon}
                {tool.label}
              </button>
            )
          })}
        </div>
          <JumpToPostsLink />
        </div>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          All figures are estimates
        </span>
      </div>

      <div
        role="tabpanel"
        id={`landscaping-tool-${active}`}
        aria-labelledby={`landscaping-tab-${active}`}
      >
        {!started[active] ? (
          <ToolCover key={active} tool={active} onStart={() => startTool(active)} />
        ) : active === "cost" ? (
          <LandscapeCostCalculator />
        ) : (
          <LandscapeMaterialsCalculator />
        )}
      </div>
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Calculator, Sprout } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CropSelectionTool } from "@/components/crop-selection-tool"
import { FarmProfitCalculator } from "@/components/farm-profit-calculator"
import { JumpToPostsLink } from "@/components/jump-to-posts-link"
import { FarmSimulator } from "@/components/farm/farm-simulator"
import { QuoteCapture } from "@/components/quote-capture"
import { type ProfitabilityHandoff } from "@/lib/crops"
import { inputsFromHandoff, type ProfitInputs } from "@/lib/farm-profit"

type ToolId = "crop" | "profit"

const TOOLS: Array<{ id: ToolId; label: string; icon: React.ReactNode }> = [
  {
    id: "crop",
    label: "Crop Selection Tool",
    icon: <Sprout className="size-4" aria-hidden="true" />,
  },
  {
    id: "profit",
    label: "Farm Profitability",
    icon: <Calculator className="size-4" aria-hidden="true" />,
  },
]

/**
 * Deep-link targets so articles can point a reader at one specific tool, e.g.
 * `/agriculture#farm-profit-calculator`.
 *
 * Both tools stay mounted here (they are only toggled with `hidden`), so the
 * browser still cannot scroll to the inactive one — a hidden element has no
 * box. The effect below selects the requested tool and then scrolls, keeping a
 * single scroll anchor (`#agriculture-calculators`) for the section as a whole.
 */
const TOOL_HASHES: Record<string, ToolId> = {
  "agriculture-calculators": "crop",
  "crop-selection-tool": "crop",
  "farm-profit-calculator": "profit",
}

const COVERS: Record<
  ToolId,
  { title: string; description: string; icon: React.ReactNode; firstFieldId: string }
> = {
  crop: {
    title: "What should you grow?",
    description:
      "Enter your location, acreage, and soil to see which crops fit your land and season best.",
    icon: <Sprout className="size-6" aria-hidden="true" />,
    firstFieldId: "crop-zip",
  },
  profit: {
    title: "Will your farm turn a profit?",
    description:
      "Enter your crop, yield, price, and costs to see expected revenue, profit, and break-even.",
    icon: <Calculator className="size-6" aria-hidden="true" />,
    firstFieldId: "fp-crop",
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

export function AgricultureTools() {
  const [active, setActive] = useState<ToolId>("crop")
  const [started, setStarted] = useState<Record<ToolId, boolean>>({
    crop: false,
    profit: false,
  })

  function startTool(tool: ToolId) {
    setStarted((prev) => ({ ...prev, [tool]: true }))
    requestAnimationFrame(() => document.getElementById(COVERS[tool].firstFieldId)?.focus())
  }
  const [seed, setSeed] = useState<ProfitInputs | null>(null)
  // Bumped on every handoff so the calculator remounts with fresh inputs even
  // when the same crop is sent across twice.
  const [seedKey, setSeedKey] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function applyHash() {
      const hash = window.location.hash.replace(/^#/, "")
      const tool = TOOL_HASHES[hash]
      if (!tool) return
      setActive(tool)
      // A direct link to a specific calculator skips its start cover.
      if (hash !== "agriculture-calculators") setStarted((prev) => ({ ...prev, [tool]: true }))
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    applyHash()
    // Also handle in-page hash changes, where React would not remount.
    window.addEventListener("hashchange", applyHash)
    return () => window.removeEventListener("hashchange", applyHash)
  }, [])

  const onSendToProfit = (handoff: ProfitabilityHandoff) => {
    setSeed(inputsFromHandoff(handoff))
    setSeedKey((k) => k + 1)
    setStarted((prev) => ({ ...prev, profit: true }))
    setActive("profit")
  }

  return (
    <div
      ref={containerRef}
      id="agriculture-calculators"
      className="flex scroll-mt-24 flex-col gap-10"
    >
      {/* Interactive clay farm sits above the calculators, the agriculture
          counterpart to the solar, landscape, and renovation explorers. */}
      <FarmSimulator />

      {/* Lead capture sits directly beneath the Visual Explorer. */}
      <QuoteCapture category="agriculture" />

      <div
        id="agriculture-calculator-tools"
        className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="tablist" aria-label="Agriculture calculators" className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {TOOLS.map((tool) => {
            const isActive = tool.id === active
            return (
              <button
                key={tool.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`agriculture-tool-${tool.id}`}
                id={`agriculture-tab-${tool.id}`}
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

      {/* Both tools stay mounted so switching tabs preserves each one's state. */}
      <div
        role="tabpanel"
        id="agriculture-tool-crop"
        aria-labelledby="agriculture-tab-crop"
        hidden={active !== "crop"}
      >
        {started.crop ? (
          <CropSelectionTool onSendToProfit={onSendToProfit} />
        ) : (
          <ToolCover tool="crop" onStart={() => startTool("crop")} />
        )}
      </div>

      <div
        role="tabpanel"
        id="agriculture-tool-profit"
        aria-labelledby="agriculture-tab-profit"
        hidden={active !== "profit"}
      >
        {started.profit ? (
          <FarmProfitCalculator key={seedKey} initialInputs={seed ?? undefined} />
        ) : (
          <ToolCover tool="profit" onStart={() => startTool("profit")} />
        )}
      </div>
    </div>
  )
}

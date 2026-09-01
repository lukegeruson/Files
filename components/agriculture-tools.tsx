"use client"

import { useEffect, useRef, useState } from "react"
import { Calculator, Sprout } from "lucide-react"
import { cn } from "@/lib/utils"
import { CropSelectionTool } from "@/components/crop-selection-tool"
import { FarmProfitCalculator } from "@/components/farm-profit-calculator"
import { JumpToPostsLink } from "@/components/jump-to-posts-link"
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
    label: "Farm Profitability Calculator",
    icon: <Calculator className="size-4" aria-hidden="true" />,
  },
]

/**
 * Deep-link targets so articles can point a reader at one specific tool, e.g.
 * `/category/agriculture#farm-profit-calculator`.
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

export function AgricultureTools() {
  const [active, setActive] = useState<ToolId>("crop")
  const [seed, setSeed] = useState<ProfitInputs | null>(null)
  // Bumped on every handoff so the calculator remounts with fresh inputs even
  // when the same crop is sent across twice.
  const [seedKey, setSeedKey] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function applyHash() {
      const tool = TOOL_HASHES[window.location.hash.replace(/^#/, "")]
      if (!tool) return
      setActive(tool)
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
    setActive("profit")
  }

  return (
    <div
      ref={containerRef}
      id="agriculture-calculators"
      className="flex scroll-mt-24 flex-col gap-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="tablist" aria-label="Agriculture calculators" className="flex flex-wrap gap-2">
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
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
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
        <CropSelectionTool onSendToProfit={onSendToProfit} />
      </div>

      <div
        role="tabpanel"
        id="agriculture-tool-profit"
        aria-labelledby="agriculture-tab-profit"
        hidden={active !== "profit"}
      >
        <FarmProfitCalculator key={seedKey} initialInputs={seed ?? undefined} />
      </div>
    </div>
  )
}

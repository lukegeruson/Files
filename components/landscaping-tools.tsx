"use client"

import { useEffect, useRef, useState } from "react"
import { Calculator, Ruler } from "lucide-react"
import { cn } from "@/lib/utils"
import { LandscapeCostCalculator } from "@/components/landscape-cost-calculator"
import { LandscapeMaterialsCalculator } from "@/components/landscape-materials-calculator"
import { JumpToPostsLink } from "@/components/jump-to-posts-link"
import { LandscapeExplorer } from "@/components/landscape/landscape-explorer"

type ToolId = "cost" | "materials"

const TOOLS: Array<{ id: ToolId; label: string; icon: React.ReactNode }> = [
  {
    id: "cost",
    label: "Landscape Cost Calculator",
    icon: <Calculator className="size-4" aria-hidden="true" />,
  },
  {
    id: "materials",
    label: "Materials & Irrigation Planner",
    icon: <Ruler className="size-4" aria-hidden="true" />,
  },
]

/**
 * Deep-link targets so articles can point a reader at one specific tool, e.g.
 * `/category/landscaping#landscape-materials-calculator`.
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

export function LandscapingTools() {
  const [active, setActive] = useState<ToolId>("cost")
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

  return (
    <div
      ref={containerRef}
      id="landscaping-calculators"
      className="flex scroll-mt-24 flex-col gap-6"
    >
      {/* Interactive clay-model yard sits above the calculators, the landscaping
          counterpart to the solar explorer. */}
      <LandscapeExplorer />

      {/* Tool switcher — additional landscaping calculators slot in here. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          role="tablist"
          aria-label="Landscaping calculators"
          className="flex flex-wrap gap-2"
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

      <div
        role="tabpanel"
        id={`landscaping-tool-${active}`}
        aria-labelledby={`landscaping-tab-${active}`}
      >
        {active === "cost" ? <LandscapeCostCalculator /> : <LandscapeMaterialsCalculator />}
      </div>
    </div>
  )
}

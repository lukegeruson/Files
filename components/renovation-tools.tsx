"use client"

import { useEffect, useRef, useState } from "react"
import { Calculator, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"
import { RemodelCostCalculator } from "@/components/remodel-cost-calculator"
import { JumpToPostsLink } from "@/components/jump-to-posts-link"
import { HomeUpgradeAdvisor } from "@/components/home-upgrade-advisor"
import { RenovationExplorer } from "@/components/renovation/renovation-explorer"

type ToolId = "advisor" | "remodel"

const TOOLS: Array<{ id: ToolId; label: string; icon: React.ReactNode }> = [
  {
    id: "advisor",
    label: "Home Upgrade Advisor",
    icon: <ClipboardList className="size-4" aria-hidden="true" />,
  },
  {
    id: "remodel",
    label: "Remodeling Cost Calculator",
    icon: <Calculator className="size-4" aria-hidden="true" />,
  },
]

/**
 * Deep-link targets so articles can point a reader at one specific tool, e.g.
 * `/category/renovation#remodel-cost-calculator`.
 *
 * These hashes intentionally do not match a real element id: only one tool is
 * mounted at a time, so the browser cannot scroll to the inactive one. The
 * effect below selects the requested tool and then scrolls, which also keeps a
 * single scroll anchor (`#renovation-calculators`) for the section as a whole.
 */
const TOOL_HASHES: Record<string, ToolId> = {
  "renovation-calculators": "advisor",
  "home-upgrade-advisor": "advisor",
  "remodel-cost-calculator": "remodel",
}

export function RenovationTools() {
  const [active, setActive] = useState<ToolId>("advisor")
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
      id="renovation-calculators"
      className="flex scroll-mt-24 flex-col gap-10"
    >
      {/* Interactive clay cutaway house sits above the calculators, the
          renovation counterpart to the solar and landscape explorers. */}
      <RenovationExplorer />

      {/* Tool switcher — additional renovation calculators slot in here. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          role="tablist"
          aria-label="Renovation calculators"
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
                aria-controls={`renovation-tool-${tool.id}`}
                id={`renovation-tab-${tool.id}`}
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
        id={`renovation-tool-${active}`}
        aria-labelledby={`renovation-tab-${active}`}
      >
        {active === "advisor" ? <HomeUpgradeAdvisor /> : <RemodelCostCalculator />}
      </div>
    </div>
  )
}

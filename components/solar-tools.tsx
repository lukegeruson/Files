"use client"

import { useEffect, useRef, useState } from "react"
import { LayoutGrid, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { SolarSavingsTool } from "@/components/solar-savings-tool"
import { SolarPanelCalculator } from "@/components/solar-panel-calculator"
import { JumpToPostsLink } from "@/components/jump-to-posts-link"
import { SolarSceneProvider } from "@/components/solar/solar-scene-context"
import { SolarExplorer } from "@/components/solar/solar-explorer"

type ToolId = "savings" | "panels"

const TOOLS: Array<{ id: ToolId; label: string; icon: React.ReactNode }> = [
  {
    id: "savings",
    label: "Solar Savings Calculator",
    icon: <Sun className="size-4" aria-hidden="true" />,
  },
  {
    id: "panels",
    label: "Solar Panel Calculator",
    icon: <LayoutGrid className="size-4" aria-hidden="true" />,
  },
]

/**
 * Deep-link targets so articles can point a reader at one specific calculator,
 * e.g. `/category/solar#solar-panel-calculator`.
 *
 * These hashes intentionally do not match a real element id: only one tool is
 * mounted at a time, so the browser cannot scroll to the inactive one. The
 * effect below selects the requested tool and then scrolls, which also keeps a
 * single scroll anchor (`#solar-calculators`) for the section as a whole.
 */
const TOOL_HASHES: Record<string, ToolId> = {
  "solar-calculators": "savings",
  "solar-savings-calculator": "savings",
  "solar-panel-calculator": "panels",
}

export function SolarTools() {
  const [active, setActive] = useState<ToolId>("savings")
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
    <SolarSceneProvider>
    <div
      ref={containerRef}
      id="solar-calculators"
      className="flex scroll-mt-24 flex-col gap-6"
    >
      {/* Interactive 3D diagram sits above the calculators and reflects their
          results once completed. */}
      <SolarExplorer />

      {/* Tool switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          role="tablist"
          aria-label="Solar calculators"
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
                aria-controls={`solar-tool-${tool.id}`}
                id={`solar-tab-${tool.id}`}
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

      {/* Active tool. Each stays mounted-on-demand so switching is instant. */}
      <div
        role="tabpanel"
        id={`solar-tool-${active}`}
        aria-labelledby={`solar-tab-${active}`}
      >
        {active === "savings" ? <SolarSavingsTool /> : <SolarPanelCalculator />}
      </div>
    </div>
    </SolarSceneProvider>
  )
}

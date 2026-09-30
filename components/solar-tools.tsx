"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, LayoutGrid, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SolarSavingsTool } from "@/components/solar-savings-tool"
import { SolarPanelCalculator } from "@/components/solar-panel-calculator"
import { JumpToPostsLink } from "@/components/jump-to-posts-link"
import { SolarSceneProvider } from "@/components/solar/solar-scene-context"
import { SolarExplorer } from "@/components/solar/solar-explorer"
import { QuoteCapture } from "@/components/quote-capture"

type ToolId = "savings" | "panels"

const TOOLS: Array<{ id: ToolId; label: string; icon: React.ReactNode }> = [
  {
    id: "savings",
    label: "Solar Savings Calculator",
    icon: <Sun className="size-4" aria-hidden="true" />,
  },
  {
    id: "panels",
    label: "Solar Sizing Calculator",
    icon: <LayoutGrid className="size-4" aria-hidden="true" />,
  },
]

/**
 * Deep-link targets so articles can point a reader at one specific calculator,
 * e.g. `/solar#solar-panel-calculator`.
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

const COVERS: Record<
  ToolId,
  { title: string; description: string; icon: React.ReactNode; firstFieldId: string }
> = {
  savings: {
    title: "Should you go solar?",
    description:
      "Answer a few quick questions to see your cost after incentives, payback period, and 25-year savings.",
    icon: <Sun className="size-6" aria-hidden="true" />,
    firstFieldId: "solar-zip",
  },
  panels: {
    title: "How many solar panels do you need?",
    description:
      "Tell us about your home and energy use to see your system size, panel count, and the roof space it takes.",
    icon: <LayoutGrid className="size-6" aria-hidden="true" />,
    firstFieldId: "panel-zip",
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

export function SolarTools() {
  const [active, setActive] = useState<ToolId>("savings")
  const [started, setStarted] = useState<Record<ToolId, boolean>>({
    savings: false,
    panels: false,
  })
  const containerRef = useRef<HTMLDivElement>(null)

  function startTool(tool: ToolId) {
    setStarted((prev) => ({ ...prev, [tool]: true }))
    // Move focus to the first field once the calculator has mounted.
    requestAnimationFrame(() => document.getElementById(COVERS[tool].firstFieldId)?.focus())
  }

  useEffect(() => {
    function applyHash() {
      const hash = window.location.hash.replace(/^#/, "")
      const tool = TOOL_HASHES[hash]
      if (!tool) return
      setActive(tool)
      // A direct link to a specific calculator skips its start cover.
      if (hash !== "solar-calculators") setStarted((prev) => ({ ...prev, [tool]: true }))
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

      {/* Lead capture sits directly beneath the Visual Explorer. */}
      <QuoteCapture category="solar" />

      {/* Tool switcher */}
      <div
        id="solar-calculator-tools"
        className="flex scroll-mt-24 flex-wrap items-center justify-between gap-x-4 gap-y-2"
      >
        <div
          role="tablist"
          aria-label="Solar calculators"
          className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap"
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
                  "inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-center text-xs transition-colors sm:px-4 sm:text-sm",
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
        {/* Blog link sits beside the "All figures are estimates" note, with
            space between them on mobile; both stay grouped to the right on
            larger screens. */}
        <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
          <JumpToPostsLink />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            All figures are estimates
          </span>
        </div>
      </div>

      {/* Active tool. Each stays mounted-on-demand so switching is instant. */}
      <div
        role="tabpanel"
        id={`solar-tool-${active}`}
        aria-labelledby={`solar-tab-${active}`}
        className="w-full"
      >
        {!started[active] ? (
          <ToolCover key={active} tool={active} onStart={() => startTool(active)} />
        ) : active === "savings" ? (
          <SolarSavingsTool />
        ) : (
          <SolarPanelCalculator />
        )}
      </div>
    </div>
    </SolarSceneProvider>
  )
}

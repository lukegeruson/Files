"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Calculator, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RemodelCostCalculator } from "@/components/remodel-cost-calculator"
import { JumpToPostsLink } from "@/components/jump-to-posts-link"
import { HomeUpgradeAdvisor } from "@/components/home-upgrade-advisor"
import { RenovationExplorer } from "@/components/renovation/renovation-explorer"
import { QuoteCapture } from "@/components/quote-capture"

type ToolId = "advisor" | "remodel"

const TOOLS: Array<{ id: ToolId; label: string; icon: React.ReactNode }> = [
  {
    id: "advisor",
    label: "Home Upgrade Advisor",
    icon: <ClipboardList className="size-4" aria-hidden="true" />,
  },
  {
    id: "remodel",
    label: "Remodeling Cost",
    icon: <Calculator className="size-4" aria-hidden="true" />,
  },
]

/**
 * Deep-link targets so articles can point a reader at one specific tool, e.g.
 * `/renovation#remodel-cost-calculator`.
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

const COVERS: Record<
  ToolId,
  { title: string; description: string; icon: React.ReactNode; firstFieldId: string }
> = {
  advisor: {
    title: "Which home upgrades pay off for you?",
    description:
      "Tell us about your home and plans to see which projects add the most value for the money.",
    icon: <ClipboardList className="size-6" aria-hidden="true" />,
    firstFieldId: "advisor-zip",
  },
  remodel: {
    title: "What will your remodel cost?",
    description:
      "Pick a room, size, and finish level to see a local price range for materials and labor.",
    icon: <Calculator className="size-6" aria-hidden="true" />,
    firstFieldId: "rm-zip",
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

export function RenovationTools() {
  const [active, setActive] = useState<ToolId>("advisor")
  const [started, setStarted] = useState<Record<ToolId, boolean>>({
    advisor: false,
    remodel: false,
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
      if (hash !== "renovation-calculators") setStarted((prev) => ({ ...prev, [tool]: true }))
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

      {/* Lead capture sits directly beneath the Visual Explorer. */}
      <QuoteCapture category="home-improvement" />

      {/* Tool switcher — additional renovation calculators slot in here. */}
      <div
        id="renovation-calculator-tools"
        className="flex scroll-mt-24 flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          role="tablist"
          aria-label="Renovation calculators"
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
                aria-controls={`renovation-tool-${tool.id}`}
                id={`renovation-tab-${tool.id}`}
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
        id={`renovation-tool-${active}`}
        aria-labelledby={`renovation-tab-${active}`}
      >
        {!started[active] ? (
          <ToolCover key={active} tool={active} onStart={() => startTool(active)} />
        ) : active === "advisor" ? (
          <HomeUpgradeAdvisor />
        ) : (
          <RemodelCostCalculator />
        )}
      </div>
    </div>
  )
}

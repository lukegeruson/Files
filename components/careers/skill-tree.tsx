"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowUpRight, ChevronDown, ChevronRight, MousePointerClick, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { INDUSTRIES, INDUSTRY_META } from "@/lib/careers/industries"
import {
  buildSkillTree,
  skillHint,
  skillLabel,
  type MasterTrack,
  type SkillTree,
  type TreeNode,
  type TreeStage,
} from "@/lib/careers/skill-tree"
import { CAREER_LEVELS, CAREER_LEVEL_LABELS } from "@/lib/careers/types"
import type { CareerLevel, Industry } from "@/lib/careers/types"

/** Trees are pure derivations of static data, so build all four once up front. */
const TREES: Record<Industry, SkillTree> = Object.fromEntries(
  INDUSTRIES.map((id) => [id, buildSkillTree(id)]),
) as Record<Industry, SkillTree>

const MASTER_TRACK_ORDER: MasterTrack[] = ["deepen", "lead", "own"]

type LevelFilter = CareerLevel | "all"

/**
 * Does this role match the current search text? Matches on role name, career
 * family, and the plain-language skill labels, so searching "wiring" finds the
 * roles that teach it rather than only roles with it in the title.
 */
function nodeMatches(node: TreeNode, needle: string): boolean {
  if (!needle) return true
  const { career, newSkills, carriedSkills } = node
  if (career.name.toLowerCase().includes(needle)) return true
  if (career.careerFamily.toLowerCase().includes(needle)) return true
  return [...newSkills, ...carriedSkills].some((id) =>
    skillLabel(id).toLowerCase().includes(needle),
  )
}

/**
 * Narrows a tree without changing its shape: every stage is preserved (the
 * desktop grid needs all three columns to keep its headings aligned) but each
 * stage's node list is filtered. Both renderers read the result, so search and
 * level filtering apply to the map and the mobile pathway from one derivation.
 */
function filterTree(tree: SkillTree, query: string, level: LevelFilter): SkillTree {
  const needle = query.trim().toLowerCase()
  if (!needle && level === "all") return tree

  const stages = tree.stages.map((stage) => ({
    ...stage,
    nodes: stage.nodes.filter(
      (n) => (level === "all" || n.career.level === level) && nodeMatches(n, needle),
    ),
  }))

  return {
    ...tree,
    stages,
    totalRoles: stages.reduce((sum, s) => sum + s.nodes.length, 0),
  }
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function SkillChip({ id, tone = "new" }: { id: string; tone?: "new" | "carried" }) {
  return (
    <li
      title={skillHint(id)}
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs leading-none",
        tone === "new"
          ? "bg-primary/10 font-medium text-primary"
          : "bg-secondary text-muted-foreground",
      )}
    >
      {skillLabel(id)}
    </li>
  )
}

/**
 * Groups the Master canopy into its three parallel tracks; other stages pass
 * through untouched. A plain function rather than a hook so both renderers can
 * call it from inside a map.
 */
function trackGroups(stage: TreeStage) {
  if (stage.meta.id !== "master") {
    return [{ track: null as MasterTrack | null, nodes: stage.nodes }]
  }
  return MASTER_TRACK_ORDER.map((track) => ({
    track,
    nodes: stage.nodes.filter((n) => n.masterTrack === track),
  })).filter((g) => g.nodes.length > 0)
}

// ---------------------------------------------------------------------------
// Node: a compact button plus a detail body rendered in one of two places
// ---------------------------------------------------------------------------

function NodeButton({
  node,
  selected,
  onSelect,
  chevron,
  controls,
}: {
  node: TreeNode
  selected: boolean
  onSelect: () => void
  chevron: boolean
  controls?: string
}) {
  const { career, newSkills } = node
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-expanded={chevron ? selected : undefined}
      aria-controls={chevron ? controls : undefined}
      aria-pressed={chevron ? undefined : selected}
      className={cn(
        "group flex w-full min-h-11 items-start gap-2 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-muted-foreground/50",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug group-hover:text-primary">
          {career.name}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{career.careerFamily}</span>
        <span className="mt-1.5 block text-xs">
          {newSkills.length > 0 ? (
            <span className="font-medium text-primary">
              +{newSkills.length} new {newSkills.length === 1 ? "skill" : "skills"}
            </span>
          ) : (
            <span className="text-muted-foreground">Builds on what you have</span>
          )}
        </span>
      </span>
      {chevron ? (
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
            selected && "rotate-180",
          )}
          aria-hidden="true"
        />
      ) : null}
    </button>
  )
}

function NodeDetail({ node }: { node: TreeNode }) {
  const { career, newSkills, carriedSkills, unlocks } = node
  // Three logical blocks. They sit side by side in the full-width band above
  // the tree and stack in the narrow inline accordion, where the source order
  // (identity, then skills, then the practicals) still reads correctly.
  return (
    <div className="grid gap-x-8 gap-y-5 lg:grid-cols-3">
      <div>
        <p className="font-serif text-lg font-semibold leading-snug">{career.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{career.careerFamily}</p>
        <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
          {career.description}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {newSkills.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-foreground">
              Skills you build here
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {newSkills.map((id) => (
                <SkillChip key={id} id={id} />
              ))}
            </ul>
          </div>
        ) : null}

        {carriedSkills.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Carried in from earlier
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {carriedSkills.map((id) => (
                <SkillChip key={id} id={id} tone="carried" />
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">
              Typical time to get here
            </dt>
            <dd className="mt-0.5 text-sm">{career.trainingTime}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">
              Experience expected
            </dt>
            <dd className="mt-0.5 text-sm">{career.experienceRequired}</dd>
          </div>
        </dl>

        {unlocks.length > 0 ? (
          <p className="mt-3 text-pretty text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Leads to: </span>
            {unlocks.map((u) => u.name).join(", ")}
          </p>
        ) : null}

        <Link
          href={`/jobs/careers/${career.id}`}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Full breakdown of this role
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared header + seed content, so both renderers stay in sync
// ---------------------------------------------------------------------------

function StageHeading({
  stage,
  index,
  total,
  arrow,
}: {
  stage: TreeStage
  index: number
  total: number
  arrow: boolean
}) {
  const { meta } = stage
  return (
    <div>
      <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {arrow ? (
          <ChevronRight className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
        ) : null}
        Stage {index + 1} of {total} &middot; {meta.timeframe}
      </p>
      {/* h2: the three stages are the top-level divisions of the tree page and
          sit directly under its h1, so h3 skipped a level. Classes unchanged. */}
      <h2
        id={`stage-${meta.id}`}
        className="mt-1 font-serif text-xl font-semibold tracking-tight"
      >
        {meta.label}
      </h2>
      <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
        {meta.promise}
      </p>
      <p className="mt-1 text-pretty text-sm leading-relaxed text-primary">{meta.reassurance}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Renderer A — wide screens: stages as columns, left to right
// ---------------------------------------------------------------------------

function StageColumnBody({
  stage,
  selectedId,
  onSelect,
}: {
  stage: TreeStage
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const groups = trackGroups(stage)
  // Master track groups are no longer labelled, so they share the card spacing
  // and read as one continuous list rather than arbitrary clusters.
  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => (
        <div key={group.track ?? "all"}>
          <ul className="flex flex-col gap-2">
            {group.nodes.map((node) => (
              <li key={node.career.id}>
                <NodeButton
                  node={node}
                  selected={selectedId === node.career.id}
                  onSelect={() => onSelect(node.career.id)}
                  chevron={false}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function TreeColumns({
  tree,
  selectedId,
  onSelect,
}: {
  tree: SkillTree
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const total = tree.stages.length
  // A single grid holds every column, so the stage headings share a row and
  // line up no matter how much copy each one carries.
  return (
    <div
      className="hidden gap-x-4 gap-y-4 xl:grid"
      style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
    >
      {tree.stages.map((stage, i) => (
        <div
          key={stage.meta.id}
          className="rounded-2xl border border-border bg-secondary/30 px-4 py-5"
        >
          <StageHeading stage={stage} index={i} total={total} arrow={i > 0} />
        </div>
      ))}

      {tree.stages.map((stage) => (
        <section key={stage.meta.id} aria-labelledby={`stage-${stage.meta.id}`}>
          <StageColumnBody stage={stage} selectedId={selectedId} onSelect={onSelect} />
        </section>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Renderer B — narrow screens: the same data as a vertical pathway
// ---------------------------------------------------------------------------

function TreePathway({
  tree,
  selectedId,
  onSelect,
}: {
  tree: SkillTree
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const total = tree.stages.length
  return (
    <div className="flex flex-col gap-4 xl:hidden">
      {tree.stages.map((stage, i) => {
        const groups = trackGroups(stage)
        return (
          <section
            key={stage.meta.id}
            aria-labelledby={`m-stage-${stage.meta.id}`}
            className="rounded-2xl border border-border bg-secondary/30 px-4 py-6 md:px-6"
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Stage {i + 1} of {total} &middot; {stage.meta.timeframe}
              </p>
              <h3
                id={`m-stage-${stage.meta.id}`}
                className="mt-1 font-serif text-2xl font-semibold tracking-tight"
              >
                {stage.meta.label}
              </h3>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">
                {stage.meta.promise}
              </p>
              <p className="mt-1.5 text-pretty text-sm leading-relaxed text-primary">
                {stage.meta.reassurance}
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {groups.map((group) => (
                <div key={group.track ?? "all"}>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {group.nodes.map((node) => {
                      const selected = selectedId === node.career.id
                      const panelId = `m-panel-${node.career.id}`
                      return (
                        <li
                          key={node.career.id}
                          className={cn(selected && "sm:col-span-2")}
                        >
                          <NodeButton
                            node={node}
                            selected={selected}
                            onSelect={() => onSelect(node.career.id)}
                            chevron
                            controls={panelId}
                          />
                          {selected ? (
                            <div
                              id={panelId}
                              className="mt-2 rounded-xl border border-border bg-card px-4 py-4"
                            >
                              <NodeDetail node={node} />
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

/**
 * Search + level filter for the active tree. Levels are drawn from the roles
 * actually present in this tree, so the control never offers a level that would
 * return nothing.
 */
function TreeFilters({
  query,
  onQuery,
  level,
  onLevel,
  levelsPresent,
}: {
  query: string
  onQuery: (v: string) => void
  level: LevelFilter
  onLevel: (v: LevelFilter) => void
  levelsPresent: CareerLevel[]
}) {
  const levels: LevelFilter[] = ["all", ...levelsPresent]

  return (
    <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div role="search" className="lg:w-80">
        <label htmlFor="tree-search" className="sr-only">
          Search roles and skills in this tree
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="tree-search"
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter can confirm CJK IME composition; results are live so
              // there is nothing to submit either way.
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              if (e.key === "Enter") e.preventDefault()
            }}
            placeholder="Search roles or skills"
            aria-controls="tree-panel"
            className="h-11 w-full rounded-full border border-border bg-card pl-11 pr-10 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-search-cancel-button]:hidden"
          />
          {query.length > 0 ? (
            <button
              type="button"
              onClick={() => onQuery("")}
              className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">Clear search</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Level
        </span>
        {levels.map((l) => {
          const active = level === l
          return (
            <button
              key={l}
              type="button"
              aria-pressed={active}
              onClick={() => onLevel(l)}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-muted-foreground",
              )}
            >
              {l === "all" ? "All" : CAREER_LEVEL_LABELS[l]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SkillTreeExplorer() {
  const searchParams = useSearchParams()
  const fromUrl = searchParams.get("industry")
  const [industry, setIndustry] = useState<Industry>(
    fromUrl && (INDUSTRIES as string[]).includes(fromUrl) ? (fromUrl as Industry) : "solar",
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [level, setLevel] = useState<LevelFilter>("all")
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const fullTree = TREES[industry]
  const tree = useMemo(() => filterTree(fullTree, query, level), [fullTree, query, level])
  const matchCount = tree.totalRoles
  const filtering = query.trim().length > 0 || level !== "all"

  // Only offer levels this tree actually contains.
  const levelsPresent = useMemo(() => {
    const seen = new Set(fullTree.stages.flatMap((s) => s.nodes.map((n) => n.career.level)))
    return CAREER_LEVELS.filter((l) => seen.has(l))
  }, [fullTree])

  // Keep the URL shareable without a navigation: replaceState avoids
  // re-running the route's Suspense boundary on every tab click.
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set("industry", industry)
    window.history.replaceState(null, "", url)
  }, [industry])

  const onSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])

  const selectIndustry = useCallback((id: Industry) => {
    setIndustry(id)
    setSelectedId(null)
    // Clearing the filters on tab change avoids landing on an empty tree
    // because a term or level from the previous industry carried over.
    setQuery("")
    setLevel("all")
  }, [])

  /** Standard tablist keyboard behaviour: arrows move, Home/End jump. */
  const onTabKeyDown = (e: ReactKeyboardEvent) => {
    const i = INDUSTRIES.indexOf(industry)
    let next = -1
    if (e.key === "ArrowRight") next = (i + 1) % INDUSTRIES.length
    else if (e.key === "ArrowLeft") next = (i - 1 + INDUSTRIES.length) % INDUSTRIES.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = INDUSTRIES.length - 1
    if (next < 0) return
    e.preventDefault()
    selectIndustry(INDUSTRIES[next])
    tabRefs.current[next]?.focus()
  }

  const selectedNode = useMemo(() => {
    if (!selectedId) return null
    for (const stage of tree.stages) {
      const hit = stage.nodes.find((n) => n.career.id === selectedId)
      if (hit) return hit
    }
    return null
  }, [tree, selectedId])

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <p className="text-sm font-medium uppercase tracking-widest text-primary">Skill trees</p>
      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-balance md:text-4xl">
        Grow a trade from the ground up
      </h1>
      <p className="mt-3 max-w-3xl text-pretty leading-relaxed text-muted-foreground">
        Every tree starts with a seed anybody can plant, then moves through three stages of skills
        you stack along the way. You are only ever looking at the next rung — the last stage is just
        there to prove the climb goes somewhere.
      </p>

      {/* Tree picker */}
      <div
        role="tablist"
        aria-label="Choose a skill tree"
        onKeyDown={onTabKeyDown}
        className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {INDUSTRIES.map((id, i) => {
          const meta = INDUSTRY_META[id]
          const active = industry === id
          const t = TREES[id]
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`tree-tab-${id}`}
              aria-selected={active}
              aria-controls="tree-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => selectIndustry(id)}
              className={cn(
                "flex min-h-11 flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-colors",
                active
                  ? cn(meta.accent.border, meta.accent.bg)
                  : "border-border bg-card hover:border-muted-foreground",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn("size-2 shrink-0 rounded-full", meta.accent.dot)}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium">{meta.label}</span>
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                {t.totalRoles} roles &middot; 3 stages
              </span>
            </button>
          )
        })}
      </div>

      <TreeFilters
        query={query}
        onQuery={setQuery}
        level={level}
        onLevel={setLevel}
        levelsPresent={levelsPresent}
      />

      {/* Result count is announced so keyboard and screen-reader users get the
          same feedback sighted users get from the tree visibly narrowing. */}
      <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">
        {filtering
          ? `${matchCount} ${matchCount === 1 ? "role" : "roles"} match in ${tree.label}`
          : ""}
      </p>

      {/* Detail band + tree. On wide screens the detail sits above the stage
          columns so a click resolves in place, at the top of the reading order;
          on narrow screens the detail opens inline under each card instead, so
          nothing is ever off-screen. */}
      <div
        id="tree-panel"
        role="tabpanel"
        aria-labelledby={`tree-tab-${industry}`}
        tabIndex={-1}
        className="mt-8"
      >
        <aside
          aria-label="Role details"
          aria-live="polite"
          className="hidden rounded-2xl border border-border bg-card px-5 py-5 xl:block"
        >
          {selectedNode ? (
            <NodeDetail node={selectedNode} />
          ) : (
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                <MousePointerClick className="size-5 text-primary" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium">Pick a role</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  Select any role below to see the skills it builds, how long it takes, and what it
                  leads to.
                </p>
              </div>
            </div>
          )}
        </aside>

        <div className="min-w-0 xl:mt-6">
          {matchCount === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center">
              <p className="text-sm font-medium">No roles match those filters</p>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                Try a broader term, or clear the level filter to see the whole {tree.label} tree
                again.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setLevel("all")
                }}
                className="mt-5 inline-flex min-h-11 items-center rounded-md border border-border bg-card px-5 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <TreeColumns tree={tree} selectedId={selectedId} onSelect={onSelect} />
              <TreePathway tree={tree} selectedId={selectedId} onSelect={onSelect} />
            </>
          )}
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Not sure which tree is yours?{" "}
        <Link
          href="/jobs/quiz?view=quiz"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Take the five-minute quiz
        </Link>
        .
      </p>

    </div>
  )
}

"use client"

// Landscape Cost Calculator — answers "how much will it cost to landscape my
// yard?" by combining material quantity math with installed pricing in one
// estimate, so every component the homeowner picks moves the same total.

import { useMemo, useState } from "react"
import {
  ArrowRight,
  Info,
  Lightbulb,
  ListTree,
  PieChart,
  Ruler,
  Sprout,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field, Panel, Segmented, Stat, selectClass } from "@/components/calculator-ui"
import { LandscapeComponentPicker } from "@/components/landscape-component-picker"
import { cn } from "@/lib/utils"
import {
  COMPONENT_BY_ID,
  DEFAULT_CONTINGENCY,
  QUALITY_LABELS,
  SCOPE_LABELS,
  SCOPE_SHARE,
  COMPONENTS,
  estimate,
  initialComponents,
  type ComponentId,
  type ComponentState,
  type Mode,
  type NumericKey,
  type Quality,
  type Scope,
} from "@/lib/landscaping"

const money = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`

/** Common lot sizes so a homeowner who doesn't know their square footage can start. */
const SIZE_PRESETS: Array<{ label: string; lotSqft: number; note: string }> = [
  { label: "Small lot", lotSqft: 2500, note: "Townhome or city lot" },
  { label: "Average lot", lotSqft: 6000, note: "Typical suburban yard" },
  { label: "Large lot", lotSqft: 12000, note: "Quarter acre and up" },
  { label: "Acre+", lotSqft: 30000, note: "Rural or estate lot" },
]

const STARTER_PACKS: Array<{
  id: string
  label: string
  description: string
  pick: ComponentId[]
}> = [
  {
    id: "refresh",
    label: "Curb appeal refresh",
    description: "New lawn, fresh beds, foundation plants",
    pick: ["sod", "mulch", "shrubs", "removal"],
  },
  {
    id: "living",
    label: "Backyard living space",
    description: "Patio, fire pit, lighting, planting",
    pick: ["patio", "firepit", "lighting", "shrubs", "sod"],
  },
  {
    id: "full",
    label: "Full yard makeover",
    description: "Grade, hardscape, plant, irrigate",
    pick: ["removal", "grading", "sod", "mulch", "trees", "shrubs", "patio", "walkway", "irrigation"],
  },
  {
    id: "problem",
    label: "Fix drainage & slope",
    description: "Water and grade problems first",
    pick: ["drainage", "grading", "wall", "sod"],
  },
]

export function LandscapeCostCalculator() {
  const [zip, setZip] = useState("")
  const [scope, setScope] = useState<Scope>("back")
  const [yardArea, setYardArea] = useState("6000")
  const [quality, setQuality] = useState<Quality>("mid")
  const [mode, setMode] = useState<Mode>("pro")
  const [contingency, setContingency] = useState(DEFAULT_CONTINGENCY)
  const [components, setComponents] = useState(initialComponents)
  const [expanded, setExpanded] = useState<ComponentId | null>(null)

  const yardAreaNum = Number.parseFloat(yardArea) || 0

  const result = useMemo(
    () =>
      estimate({
        zip,
        yardArea: yardAreaNum,
        scope,
        quality,
        mode,
        contingencyPercent: contingency,
        components,
      }),
    [zip, yardAreaNum, scope, quality, mode, contingency, components],
  )

  const lineTotals = useMemo(
    () => new Map(result.lines.map((l) => [l.id, l.total])),
    [result.lines],
  )

  function toggleComponent(id: ComponentId) {
    setComponents((prev) => {
      const next = { ...prev, [id]: { ...prev[id], enabled: !prev[id].enabled } }
      // Turning something on for the first time: size it from the yard area
      // so the homeowner sees a real number before touching any field.
      const def = COMPONENT_BY_ID[id]
      if (!prev[id].enabled && def.autofillShare && yardAreaNum > 0) {
        const scoped = yardAreaNum * SCOPE_SHARE[scope]
        next[id] = { ...next[id], area: Math.round(scoped * def.autofillShare) }
      }
      return next
    })
  }

  function setNumber(id: ComponentId, key: NumericKey, value: number) {
    setComponents((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }))
  }

  function setOption(id: ComponentId, value: string) {
    setComponents((prev) => ({ ...prev, [id]: { ...prev[id], option: value } }))
  }

  function applyPack(pick: ComponentId[]) {
    const scoped = yardAreaNum * SCOPE_SHARE[scope]
    setComponents(() => {
      const fresh = initialComponents()
      const next: Record<ComponentId, ComponentState> = { ...fresh }
      for (const id of pick) {
        const def = COMPONENT_BY_ID[id]
        next[id] = {
          ...fresh[id],
          enabled: true,
          ...(def.autofillShare && scoped > 0
            ? { area: Math.round(scoped * def.autofillShare) }
            : {}),
        }
      }
      return next
    })
    setExpanded(null)
  }

  function clearAll() {
    setComponents(initialComponents())
    setExpanded(null)
  }

  const selectedCount = COMPONENTS.filter((d) => components[d.id].enabled).length
  const maxBucket = Math.max(...result.buckets.map((b) => b.amount), 1)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h2 className="text-balance font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          How much will it cost to landscape my yard?
        </h2>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          Pick the parts of the project you actually want. This calculator works out the material
          quantities and prices them together into one estimate with a full breakdown.
        </p>
      </div>

      {/* Step 1: the yard */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            1 — Your yard
          </p>
        </div>
        <div className="flex flex-col gap-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="ZIP code"
              htmlFor="lc-zip"
              hint={
                result.region.isFallback
                  ? "Using national average pricing until a ZIP is entered."
                  : `${result.region.stateName} runs about ${Math.round((result.region.index - 1) * 100)}% ${
                      result.region.index >= 1 ? "above" : "below"
                    } the national average.`
              }
            >
              <Input
                id="lc-zip"
                inputMode="numeric"
                maxLength={5}
                placeholder="e.g. 30301"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
            </Field>

            <Field
              label="Total yard size"
              htmlFor="lc-area"
              hint="Used to pre-size components and to work out price per square foot."
            >
              <div className="relative">
                <Input
                  id="lc-area"
                  inputMode="decimal"
                  className="pr-14"
                  placeholder="6000"
                  value={yardArea}
                  onChange={(e) => setYardArea(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  sq ft
                </span>
              </div>
            </Field>
          </div>

          <Field label="Not sure of the size? Start from a typical lot">
            <div className="flex flex-wrap gap-2">
              {SIZE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  title={p.note}
                  onClick={() => setYardArea(String(p.lotSqft))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    yardAreaNum === p.lotSqft
                      ? "border-primary bg-primary/15 font-medium text-foreground"
                      : "border-input bg-background text-muted-foreground hover:border-ring hover:text-foreground",
                  )}
                >
                  {p.label}
                  <span className="ml-1.5 tabular-nums text-xs opacity-70">
                    {p.lotSqft.toLocaleString("en-US")}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="Which part of the property?"
            hint="Sets how much of the lot the work covers when sizing components."
          >
            <Segmented
              ariaLabel="Project scope"
              value={scope}
              onChange={setScope}
              options={(Object.keys(SCOPE_LABELS) as Scope[]).map((v) => ({
                value: v,
                label: SCOPE_LABELS[v],
              }))}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Finish level"
              hint="Mostly changes material grade: plant size, paver and stone quality."
            >
              <Segmented
                ariaLabel="Finish level"
                value={quality}
                onChange={setQuality}
                options={(Object.keys(QUALITY_LABELS) as Quality[]).map((v) => ({
                  value: v,
                  label: QUALITY_LABELS[v],
                }))}
              />
            </Field>
            <Field
              label="Who is doing the work?"
              hint="DIY drops installation labor but adds tool and equipment rental."
            >
              <Segmented
                ariaLabel="Installation method"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "pro" as Mode, label: "Hire a pro" },
                  { value: "diy" as Mode, label: "DIY materials" },
                ]}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Step 2: components */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              2 — What do you want done?
            </p>
            {selectedCount > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Clear all ({selectedCount})
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-b border-border px-5 py-4">
            <p className="text-xs text-muted-foreground">Or start from a common project:</p>
            <div className="flex flex-wrap gap-2">
              {STARTER_PACKS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.description}
                  onClick={() => applyPack(p.pick)}
                  className="rounded-full border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            <LandscapeComponentPicker
              components={components}
              expanded={expanded}
              onToggle={toggleComponent}
              onExpand={setExpanded}
              onNumber={setNumber}
              onOption={setOption}
              lineTotals={lineTotals}
            />
          </div>
        </div>

        {/* Sticky live total — top-20 clears the 4rem sticky navbar with a small buffer */}
        <div className="lg:sticky lg:top-20">
          {result.isEmpty ? (
            <div className="rounded-lg border border-dashed border-border bg-card px-5 py-10 text-center">
              <Sprout className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-2 font-serif text-lg font-semibold">Your estimate appears here</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Select the components you want, or pick a common project above, and the total updates
                as you go.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-primary bg-primary/10 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Estimated project cost
                </p>
                <p className="mt-2 font-serif text-3xl font-semibold leading-none tabular-nums">
                  {money(result.low)} – {money(result.high)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Midpoint {money(result.total)}
                  {result.perSqft
                    ? ` · about $${result.perSqft.toFixed(2)}/sq ft of yard`
                    : ""}
                </p>
                <p className="mt-3 border-t border-primary/20 pt-3 text-xs leading-relaxed text-muted-foreground">
                  {mode === "diy"
                    ? "DIY: materials, delivery, and tool rental. No installation labor."
                    : "Professionally installed, including labor and equipment."}
                  {" "}
                  {QUALITY_LABELS[quality]} finishes in {result.region.stateName}.
                </p>
              </div>

              {/* Cost buckets */}
              <Panel
                title="Where the money goes"
                icon={<PieChart className="size-4 text-primary" aria-hidden="true" />}
              >
                <ul className="flex flex-col gap-3">
                  {result.buckets.map((b) => (
                    <li key={b.key} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">{b.label}</span>
                        <span className="font-serif tabular-nums">{money(b.amount)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(b.amount / maxBucket) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
                  <label
                    htmlFor="lc-contingency"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Contingency — {contingency}%
                  </label>
                  <input
                    id="lc-contingency"
                    type="range"
                    min={0}
                    max={25}
                    step={1}
                    value={contingency}
                    onChange={(e) => setContingency(Number(e.target.value))}
                    className="h-9 w-full accent-primary"
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Buffer for surprises: rock, roots, buried utilities, bad soil. 10–15% is normal.
                  </p>
                </div>
              </Panel>
            </div>
          )}
        </div>
      </div>

      {/* Itemized breakdown */}
      {!result.isEmpty ? (
        <>
          <Panel
            title="Itemized breakdown"
            icon={<ListTree className="size-4 text-primary" aria-hidden="true" />}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <caption className="sr-only">
                  Estimated cost by project component, split into materials, labor, equipment,
                  delivery and removal
                </caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Component</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Materials</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Labor</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Equip.</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Delivery</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Removal</th>
                    <th scope="col" className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {result.lines.map((l) => (
                    <tr key={l.id} className="border-b border-border align-top">
                      <th scope="row" className="py-3 pr-3 text-left font-normal">
                        <span className="block text-foreground">{l.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {l.quantities.map((q) => `${q.label}: ${q.value}`).join(" · ")}
                        </span>
                      </th>
                      <td className="py-3 pr-3 text-right">{money(l.materials)}</td>
                      <td className="py-3 pr-3 text-right">
                        {l.labor > 0 ? money(l.labor) : "—"}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        {l.equipment > 0 ? money(l.equipment) : "—"}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        {l.delivery > 0 ? money(l.delivery) : "—"}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        {l.removal > 0 ? money(l.removal) : "—"}
                      </td>
                      <td className="py-3 text-right font-medium text-foreground">
                        {money(l.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="tabular-nums">
                  <tr className="border-b border-border">
                    <th scope="row" className="py-3 pr-3 text-left font-normal text-muted-foreground">
                      Subtotal
                    </th>
                    <td colSpan={5} />
                    <td className="py-3 text-right">{money(result.subtotal)}</td>
                  </tr>
                  <tr className="border-b border-border">
                    <th scope="row" className="py-3 pr-3 text-left font-normal text-muted-foreground">
                      Contingency ({contingency}%)
                    </th>
                    <td colSpan={5} />
                    <td className="py-3 text-right">{money(result.contingency)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className="py-3 pr-3 text-left font-medium">
                      Estimated total
                    </th>
                    <td colSpan={5} />
                    <td className="py-3 text-right font-serif text-lg font-semibold">
                      {money(result.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Cost drivers */}
            <Panel
              title="Where is your money going?"
              icon={<Ruler className="size-4 text-primary" aria-hidden="true" />}
            >
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                These components account for most of the estimate. Changing one of them moves the
                total far more than trimming everything else.
              </p>
              <ul className="flex flex-col gap-3">
                {result.drivers.map((d) => (
                  <li key={d.label} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-foreground">{d.label}</span>
                      <span className="font-serif tabular-nums text-muted-foreground">
                        {money(d.amount)} · {Math.round(d.share * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, d.share * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>

            {/* Ways to reduce cost */}
            <Panel
              title="Ways to reduce cost"
              icon={<Lightbulb className="size-4 text-primary" aria-hidden="true" />}
            >
              <ul className="flex flex-col gap-4">
                {result.savings.map((s) => (
                  <li key={s.title} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium leading-snug text-foreground">{s.title}</p>
                      {s.savesAbout && s.savesAbout > 0 ? (
                        <span className="shrink-0 font-serif text-sm tabular-nums text-primary">
                          −{money(s.savesAbout)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{s.detail}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            These are planning estimates built from regional average material and labor rates, not a
            quote. Access, soil, rock, permits, and season all move real bids. Use the itemized
            breakdown to compare contractor proposals line by line.
          </p>
        </>
      ) : null}
    </div>
  )
}

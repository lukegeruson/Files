"use client"

// Landscape Materials & Irrigation Planner — answers the two questions every
// homeowner hits mid-project: "how much material do I need?" and "how much
// water does my yard need?". Area x depth -> cubic yards / tons / bags is the
// fast path; irrigation planning is the same area math pushed into zones,
// runtimes and gallons.

import { useMemo, useState } from "react"
import {
  Boxes,
  BrickWall,
  Calculator,
  Droplets,
  Flower2,
  Gauge,
  Info,
  Layers,
  Lightbulb,
  Mountain,
  Ruler,
  Shovel,
  Sprout,
  TriangleAlert,
  Waves,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field, Panel, Segmented, Stat, selectClass } from "@/components/calculator-ui"
import { AreaBuilder, newShape, type AreaMode } from "@/components/landscape-area-builder"
import { cn } from "@/lib/utils"
import {
  BULK_PROJECTS,
  CONCRETE_BAGS,
  DEPTH_GUIDE,
  HEAD_TYPES,
  MATERIALS,
  PAVER_SIZES,
  PAVER_USES,
  PLANT_SIZES,
  PROJECT_LABELS,
  PROJECT_QUESTIONS,
  SEED_TYPES,
  SOD_TYPES,
  SOIL_LABELS,
  SOURCE_LABELS,
  defaultDepth,
  defaultVariant,
  defaultWaste,
  planIrrigation,
  planMaterial,
  totalArea,
  totalPerimeter,
  type Metric,
  type PaverUse,
  type ProjectId,
  type SoilType,
  type WaterSource,
} from "@/lib/landscape-materials"

const int = (v: number) => Math.round(v).toLocaleString("en-US")
const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-US")
const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`

const PROJECT_ICONS: Record<ProjectId, React.ReactNode> = {
  gravel: <Mountain className="size-4" aria-hidden="true" />,
  mulch: <Layers className="size-4" aria-hidden="true" />,
  topsoil: <Shovel className="size-4" aria-hidden="true" />,
  sand: <Waves className="size-4" aria-hidden="true" />,
  sod: <Sprout className="size-4" aria-hidden="true" />,
  seed: <Sprout className="size-4" aria-hidden="true" />,
  pavers: <BrickWall className="size-4" aria-hidden="true" />,
  concrete: <Boxes className="size-4" aria-hidden="true" />,
  beds: <Flower2 className="size-4" aria-hidden="true" />,
  irrigation: <Droplets className="size-4" aria-hidden="true" />,
}

const PROJECT_ORDER: ProjectId[] = [
  "gravel",
  "mulch",
  "topsoil",
  "sand",
  "sod",
  "seed",
  "pavers",
  "concrete",
  "beds",
  "irrigation",
]

/** Real-world reference points so a beginner can sanity-check their numbers. */
const AREA_EXAMPLES = [
  { label: "Small bed", sqft: 100, note: "10 x 10 ft foundation planting" },
  { label: "Front beds", sqft: 300, note: "Typical wrap-around beds" },
  { label: "Patio", sqft: 400, note: "20 x 20 ft entertaining space" },
  { label: "Small lawn", sqft: 1500, note: "Front yard turf area" },
  { label: "Average lawn", sqft: 5000, note: "Suburban front and back" },
]

export function LandscapeMaterialsCalculator() {
  const [project, setProject] = useState<ProjectId>("mulch")
  const [beginner, setBeginner] = useState(true)
  const [zip, setZip] = useState("")

  // --- Material area ---
  const [areaMode, setAreaMode] = useState<AreaMode>("measure")
  const [shapes, setShapes] = useState(() => [newShape()])
  const [knownArea, setKnownArea] = useState("")

  // --- Material options ---
  const [variant, setVariant] = useState(() => defaultVariant("mulch"))
  const [depth, setDepth] = useState(() => String(defaultDepth("mulch")))
  const [waste, setWaste] = useState(() => defaultWaste("mulch"))
  const [supply, setSupply] = useState<"bulk" | "bag">("bulk")
  const [seedMode, setSeedMode] = useState<"new" | "over">("new")
  const [paverUse, setPaverUse] = useState<PaverUse>("patio")
  const [concreteBag, setConcreteBag] = useState("80")
  const [concreteSupply, setConcreteSupply] = useState<"ready" | "bag">("bag")
  const [plantSize, setPlantSize] = useState("1gal")
  const [plantSpacing, setPlantSpacing] = useState("2")

  // --- Irrigation ---
  const [lawnMode, setLawnMode] = useState<AreaMode>("known")
  const [lawnShapes, setLawnShapes] = useState(() => [newShape()])
  const [lawnKnown, setLawnKnown] = useState("5000")
  const [bedMode, setBedMode] = useState<AreaMode>("known")
  const [bedShapes, setBedShapes] = useState(() => [newShape()])
  const [bedKnown, setBedKnown] = useState("400")
  const [source, setSource] = useState<WaterSource>("municipal")
  const [gpm, setGpm] = useState("")
  const [head, setHead] = useState("rotor")
  const [bedHead, setBedHead] = useState("drip")
  const [soil, setSoil] = useState<SoilType>("loam")
  const [frequency, setFrequency] = useState(3)
  const [slope, setSlope] = useState(false)
  const [inchesOverride, setInchesOverride] = useState("")

  const isIrrigation = project === "irrigation"
  const isBulk = BULK_PROJECTS.includes(project)

  const area =
    areaMode === "known" ? Number.parseFloat(knownArea) || 0 : totalArea(shapes)
  const perimeter =
    areaMode === "known" ? Math.sqrt(Math.max(0, area)) * 4 : totalPerimeter(shapes)

  const lawnArea = lawnMode === "known" ? Number.parseFloat(lawnKnown) || 0 : totalArea(lawnShapes)
  const bedArea = bedMode === "known" ? Number.parseFloat(bedKnown) || 0 : totalArea(bedShapes)

  function changeProject(next: ProjectId) {
    setProject(next)
    if (next === "irrigation") return
    setVariant(defaultVariant(next))
    setDepth(String(defaultDepth(next)))
    setWaste(defaultWaste(next))
  }

  const plan = useMemo(
    () =>
      planMaterial({
        project: isIrrigation ? "mulch" : project,
        area,
        perimeter,
        depth: Number.parseFloat(depth) || 0,
        wastePercent: waste,
        variant,
        zip,
        supply,
        seedMode,
        paverUse,
        concreteBag,
        concreteSupply,
        plantSize,
        plantSpacing: Number.parseFloat(plantSpacing) || 2,
      }),
    [
      isIrrigation,
      project,
      area,
      perimeter,
      depth,
      waste,
      variant,
      zip,
      supply,
      seedMode,
      paverUse,
      concreteBag,
      concreteSupply,
      plantSize,
      plantSpacing,
    ],
  )

  const irrigation = useMemo(
    () =>
      planIrrigation({
        zip,
        lawnArea,
        bedArea,
        source,
        gpm: Number.parseFloat(gpm) || 0,
        head,
        bedHead,
        soil,
        frequency,
        weeklyInchesOverride: Number.parseFloat(inchesOverride) || null,
        slope,
      }),
    [zip, lawnArea, bedArea, source, gpm, head, bedHead, soil, frequency, inchesOverride, slope],
  )

  const hasArea = isIrrigation ? lawnArea + bedArea > 0 : area > 0
  const depthGuide = DEPTH_GUIDE[project]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h2 className="text-balance font-serif text-3xl font-semibold tracking-tight md:text-4xl">
          {PROJECT_QUESTIONS[project]}
        </h2>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          {isIrrigation
            ? "Enter what you water and how fast your system runs to get zone counts, runtimes, weekly gallons and a schedule tuned to your climate and soil."
            : "Measure the area, pick a depth, and get cubic yards, tons, bags and pallets with a waste allowance already built in."}
        </p>
      </div>

      {/* Project selector */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            1 — What are you working on?
          </p>
          <Segmented
            ariaLabel="Detail level"
            value={beginner ? "simple" : "advanced"}
            onChange={(v) => setBeginner(v === "simple")}
            options={[
              { value: "simple", label: "Guided" },
              { value: "advanced", label: "Advanced" },
            ]}
          />
        </div>
        <div className="p-5">
          <div
            role="group"
            aria-label="Project type"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
          >
            {PROJECT_ORDER.map((id) => {
              const active = id === project
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => changeProject(id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/15 font-medium text-foreground"
                      : "border-input bg-background text-muted-foreground hover:border-ring hover:text-foreground",
                  )}
                >
                  {PROJECT_ICONS[id]}
                  <span className="leading-tight">{PROJECT_LABELS[id]}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {isIrrigation ? (
        <IrrigationSections
          zip={zip}
          setZip={setZip}
          beginner={beginner}
          lawnMode={lawnMode}
          setLawnMode={setLawnMode}
          lawnShapes={lawnShapes}
          setLawnShapes={setLawnShapes}
          lawnKnown={lawnKnown}
          setLawnKnown={setLawnKnown}
          lawnArea={lawnArea}
          bedMode={bedMode}
          setBedMode={setBedMode}
          bedShapes={bedShapes}
          setBedShapes={setBedShapes}
          bedKnown={bedKnown}
          setBedKnown={setBedKnown}
          bedArea={bedArea}
          source={source}
          setSource={setSource}
          gpm={gpm}
          setGpm={setGpm}
          head={head}
          setHead={setHead}
          bedHead={bedHead}
          setBedHead={setBedHead}
          soil={soil}
          setSoil={setSoil}
          frequency={frequency}
          setFrequency={setFrequency}
          slope={slope}
          setSlope={setSlope}
          inchesOverride={inchesOverride}
          setInchesOverride={setInchesOverride}
          plan={irrigation}
          hasArea={hasArea}
        />
      ) : (
        <>
          {/* Step 2: measure */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="flex flex-col gap-6">
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-5 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    2 — Measure the area
                  </p>
                </div>
                <div className="flex flex-col gap-5 p-5">
                  <AreaBuilder
                    idPrefix="mat"
                    label="How will you enter the size?"
                    hint={
                      beginner
                        ? "Pace it out if you don't have a tape: an average adult step is about 2.5 ft."
                        : undefined
                    }
                    mode={areaMode}
                    setMode={setAreaMode}
                    shapes={shapes}
                    setShapes={setShapes}
                    knownArea={knownArea}
                    setKnownArea={setKnownArea}
                    beginner={beginner}
                    area={area}
                  />

                  {beginner ? (
                    <Field label="Not sure? Start from a common size">
                      <div className="flex flex-wrap gap-2">
                        {AREA_EXAMPLES.map((ex) => (
                          <button
                            key={ex.label}
                            type="button"
                            title={ex.note}
                            onClick={() => {
                              setAreaMode("known")
                              setKnownArea(String(ex.sqft))
                            }}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-sm transition-colors",
                              areaMode === "known" && Number(knownArea) === ex.sqft
                                ? "border-primary bg-primary/15 font-medium text-foreground"
                                : "border-input bg-background text-muted-foreground hover:border-ring hover:text-foreground",
                            )}
                          >
                            {ex.label}
                            <span className="ml-1.5 tabular-nums text-xs opacity-70">
                              {ex.sqft.toLocaleString("en-US")}
                            </span>
                          </button>
                        ))}
                      </div>
                    </Field>
                  ) : null}

                  <Field
                    label="ZIP code (optional)"
                    htmlFor="mat-zip"
                    hint={
                      plan.region.isFallback
                        ? "Used only to localize material pricing. Quantities don't change."
                        : `Pricing adjusted for ${plan.region.stateName}.`
                    }
                  >
                    <Input
                      id="mat-zip"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="e.g. 30301"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              {/* Step 3: material */}
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-5 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    3 — {isBulk || project === "concrete" ? "Material & depth" : "Material options"}
                  </p>
                </div>
                <div className="flex flex-col gap-5 p-5">
                  {/* Variant pickers */}
                  {isBulk ? (
                    <Field
                      label={`${PROJECT_LABELS[project]} type`}
                      htmlFor="mat-variant"
                      hint={
                        MATERIALS[project as "gravel" | "mulch" | "topsoil" | "sand"].find(
                          (v) => v.value === variant,
                        )?.note
                      }
                    >
                      <select
                        id="mat-variant"
                        className={selectClass}
                        value={variant}
                        onChange={(e) => setVariant(e.target.value)}
                      >
                        {MATERIALS[project as "gravel" | "mulch" | "topsoil" | "sand"].map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}

                  {project === "sod" ? (
                    <Field
                      label="Grass type"
                      htmlFor="mat-variant"
                      hint={SOD_TYPES.find((v) => v.value === variant)?.note}
                    >
                      <select
                        id="mat-variant"
                        className={selectClass}
                        value={variant}
                        onChange={(e) => setVariant(e.target.value)}
                      >
                        {SOD_TYPES.map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}

                  {project === "seed" ? (
                    <>
                      <Field
                        label="Grass type"
                        htmlFor="mat-variant"
                        hint={SEED_TYPES.find((v) => v.value === variant)?.note}
                      >
                        <select
                          id="mat-variant"
                          className={selectClass}
                          value={variant}
                          onChange={(e) => setVariant(e.target.value)}
                        >
                          {SEED_TYPES.map((v) => (
                            <option key={v.value} value={v.value}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label="New lawn or overseeding?"
                        hint="Overseeding uses half the rate because the existing lawn already fills the space."
                      >
                        <Segmented
                          ariaLabel="Seeding purpose"
                          value={seedMode}
                          onChange={setSeedMode}
                          options={[
                            { value: "new" as const, label: "New lawn (bare soil)" },
                            { value: "over" as const, label: "Overseed existing" },
                          ]}
                        />
                      </Field>
                    </>
                  ) : null}

                  {project === "pavers" ? (
                    <>
                      <Field label="Paver size" htmlFor="mat-variant">
                        <select
                          id="mat-variant"
                          className={selectClass}
                          value={variant}
                          onChange={(e) => setVariant(e.target.value)}
                        >
                          {PAVER_SIZES.map((v) => (
                            <option key={v.value} value={v.value}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label="What is it for?"
                        hint={PAVER_USES[paverUse].note}
                      >
                        <Segmented
                          ariaLabel="Paver application"
                          value={paverUse}
                          onChange={setPaverUse}
                          options={(Object.keys(PAVER_USES) as PaverUse[]).map((k) => ({
                            value: k,
                            label: PAVER_USES[k].label,
                          }))}
                        />
                      </Field>
                    </>
                  ) : null}

                  {project === "concrete" ? (
                    <>
                      <Field
                        label="How are you buying it?"
                        hint="Past about 2 cubic yards, a ready-mix truck beats mixing bags on both cost and effort."
                      >
                        <Segmented
                          ariaLabel="Concrete supply"
                          value={concreteSupply}
                          onChange={setConcreteSupply}
                          options={[
                            { value: "bag" as const, label: "Bagged mix" },
                            { value: "ready" as const, label: "Ready-mix truck" },
                          ]}
                        />
                      </Field>
                      {concreteSupply === "bag" ? (
                        <Field label="Bag size" htmlFor="mat-bag">
                          <select
                            id="mat-bag"
                            className={selectClass}
                            value={concreteBag}
                            onChange={(e) => setConcreteBag(e.target.value)}
                          >
                            {CONCRETE_BAGS.map((b) => (
                              <option key={b.value} value={b.value}>
                                {b.label} — {b.cuFt} cu ft yield
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : null}
                    </>
                  ) : null}

                  {project === "beds" ? (
                    <>
                      <Field
                        label="Plant size"
                        htmlFor="mat-plant"
                        hint={PLANT_SIZES.find((p) => p.value === plantSize)?.note}
                      >
                        <select
                          id="mat-plant"
                          className={selectClass}
                          value={plantSize}
                          onChange={(e) => {
                            setPlantSize(e.target.value)
                            const spec = PLANT_SIZES.find((p) => p.value === e.target.value)
                            if (spec) setPlantSpacing(String(spec.spacing))
                          }}
                        >
                          {PLANT_SIZES.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label="Spacing on center"
                        htmlFor="mat-spacing"
                        hint="Distance from the center of one plant to the next. Use the mature width from the plant tag."
                      >
                        <div className="relative">
                          <Input
                            id="mat-spacing"
                            inputMode="decimal"
                            className="pr-10"
                            value={plantSpacing}
                            onChange={(e) => setPlantSpacing(e.target.value)}
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            ft
                          </span>
                        </div>
                      </Field>
                    </>
                  ) : null}

                  {/* Depth */}
                  {isBulk || project === "concrete" || project === "beds" ? (
                    <Field
                      label={
                        project === "concrete"
                          ? "Slab thickness"
                          : project === "beds"
                            ? "Mulch depth"
                            : "Depth"
                      }
                      htmlFor="mat-depth"
                      hint={
                        depthGuide
                          ? depthGuide.hint
                          : project === "concrete"
                            ? "4 in covers patios and walkways. Go to 5-6 in wherever a vehicle drives."
                            : "2-3 in of mulch over the finished bed is plenty."
                      }
                    >
                      <div className="flex flex-col gap-2">
                        <div className="relative">
                          <Input
                            id="mat-depth"
                            inputMode="decimal"
                            className="pr-14"
                            value={depth}
                            onChange={(e) => setDepth(e.target.value)}
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            inches
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(project === "concrete" ? [4, 5, 6] : [1, 2, 3, 4, 6, 12]).map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDepth(String(d))}
                              className={cn(
                                "rounded-md border px-2.5 py-1 text-xs tabular-nums transition-colors",
                                Number(depth) === d
                                  ? "border-primary bg-primary/15 font-medium text-foreground"
                                  : "border-input bg-background text-muted-foreground hover:border-ring hover:text-foreground",
                              )}
                            >
                              {d} in
                            </button>
                          ))}
                        </div>
                      </div>
                    </Field>
                  ) : null}

                  {/* Supply */}
                  {isBulk ? (
                    <Field
                      label="Bulk or bagged?"
                      hint="Bulk is delivered loose by the cubic yard. Bagged is easier to handle but costs 2-3x more per yard."
                    >
                      <Segmented
                        ariaLabel="Supply method"
                        value={supply}
                        onChange={setSupply}
                        options={[
                          { value: "bulk" as const, label: "Bulk delivery" },
                          { value: "bag" as const, label: "Bags from a store" },
                        ]}
                      />
                    </Field>
                  ) : null}

                  {/* Waste */}
                  {!beginner ? (
                    <div className="flex flex-col gap-1.5 border-t border-border pt-4">
                      <label
                        htmlFor="mat-waste"
                        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                      >
                        Waste / overage — {waste}%
                      </label>
                      <input
                        id="mat-waste"
                        type="range"
                        min={0}
                        max={25}
                        step={1}
                        value={waste}
                        onChange={(e) => setWaste(Number(e.target.value))}
                        className="h-9 w-full accent-primary"
                      />
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Covers settling, spillage, cuts and uneven ground. 10% is standard; use
                        15% for curved layouts or rough grade.
                      </p>
                    </div>
                  ) : (
                    <p className="flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      A {waste}% waste allowance is already included. Switch to Advanced to change
                      it.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky answer — top-20 clears the 4rem sticky navbar with a small buffer */}
            <div className="lg:sticky lg:top-20">
              {!hasArea ? (
                <div className="rounded-lg border border-dashed border-border bg-card px-5 py-10 text-center">
                  <Calculator className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
                  <h3 className="mt-2 font-serif text-lg font-semibold">Your quantity appears here</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Enter the area above and the cubic yards, tons and bags update as you type.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="rounded-lg border border-primary bg-primary/10 p-5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      You need
                    </p>
                    <p className="mt-2 font-serif text-4xl font-semibold leading-none tabular-nums">
                      {plan.headline.value}
                    </p>
                    <p className="mt-2 text-sm text-foreground">{plan.headline.label}</p>
                    {plan.headline.sub ? (
                      <p className="mt-3 border-t border-primary/20 pt-3 text-xs leading-relaxed text-muted-foreground">
                        {plan.headline.sub}
                      </p>
                    ) : null}
                  </div>

                  <Panel
                    title="What to order"
                    icon={<Ruler className="size-4 text-primary" aria-hidden="true" />}
                  >
                    <MetricList metrics={plan.order} />
                  </Panel>

                  <Panel
                    title="Estimated material cost"
                    icon={<Boxes className="size-4 text-primary" aria-hidden="true" />}
                  >
                    <ul className="flex flex-col gap-3">
                      {plan.costs
                        .filter((c) => c.amount > 0)
                        .map((c) => (
                          <li key={c.label} className="flex flex-col gap-0.5">
                            <div className="flex items-baseline justify-between gap-3 text-sm">
                              <span className="text-muted-foreground">{c.label}</span>
                              <span className="shrink-0 font-serif tabular-nums">
                                {money(c.amount)}
                              </span>
                            </div>
                            {c.note ? (
                              <span className="text-xs leading-relaxed text-muted-foreground/80">
                                {c.note}
                              </span>
                            ) : null}
                          </li>
                        ))}
                    </ul>
                    <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-border pt-3">
                      <span className="text-sm font-medium">Total materials</span>
                      <span className="font-serif text-xl font-semibold tabular-nums">
                        {money(plan.costTotal)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {plan.costNote}
                    </p>
                  </Panel>
                </div>
              )}
            </div>
          </div>

          {hasArea ? (
            <>
              <Panel
                title="Every number, broken out"
                icon={<Gauge className="size-4 text-primary" aria-hidden="true" />}
              >
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  {plan.metrics.map((m) => (
                    <Stat
                      key={m.label}
                      label={m.label}
                      value={m.value}
                      sub={m.hint}
                      emphasis={m.emphasis}
                    />
                  ))}
                </div>
              </Panel>

              <div className="grid gap-6 md:grid-cols-2">
                <Panel
                  title="How we got there"
                  icon={<Calculator className="size-4 text-primary" aria-hidden="true" />}
                >
                  <ol className="flex flex-col gap-3">
                    {plan.steps.map((s) => (
                      <li key={s.label} className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">{s.label}</span>
                        <span className="text-sm leading-relaxed tabular-nums text-muted-foreground">
                          {s.detail}
                        </span>
                      </li>
                    ))}
                  </ol>
                </Panel>

                <Panel
                  title="Get it right the first time"
                  icon={<Lightbulb className="size-4 text-primary" aria-hidden="true" />}
                >
                  <ul className="flex flex-col gap-3">
                    {plan.tips.map((t) => (
                      <li key={t} className="text-sm leading-relaxed text-muted-foreground">
                        {t}
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>

              <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Quantities are exact math on the numbers you entered. Material weights vary with
                moisture and stone size, so confirm the conversion your supplier uses before
                ordering by the ton.
              </p>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}

function MetricList({ metrics }: { metrics: Metric[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {metrics.map((m) => (
        <li key={m.label} className="flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">{m.label}</span>
            <span
              className={cn(
                "shrink-0 font-serif tabular-nums",
                m.emphasis ? "text-lg font-semibold text-foreground" : "text-sm",
              )}
            >
              {m.value}
            </span>
          </div>
          {m.hint ? (
            <span className="text-xs leading-relaxed text-muted-foreground/80">{m.hint}</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

// --- Irrigation ------------------------------------------------------------

function IrrigationSections(props: {
  zip: string
  setZip: (v: string) => void
  beginner: boolean
  lawnMode: AreaMode
  setLawnMode: (m: AreaMode) => void
  lawnShapes: ReturnType<typeof newShape>[]
  setLawnShapes: (s: ReturnType<typeof newShape>[]) => void
  lawnKnown: string
  setLawnKnown: (v: string) => void
  lawnArea: number
  bedMode: AreaMode
  setBedMode: (m: AreaMode) => void
  bedShapes: ReturnType<typeof newShape>[]
  setBedShapes: (s: ReturnType<typeof newShape>[]) => void
  bedKnown: string
  setBedKnown: (v: string) => void
  bedArea: number
  source: WaterSource
  setSource: (v: WaterSource) => void
  gpm: string
  setGpm: (v: string) => void
  head: string
  setHead: (v: string) => void
  bedHead: string
  setBedHead: (v: string) => void
  soil: SoilType
  setSoil: (v: SoilType) => void
  frequency: number
  setFrequency: (v: number) => void
  slope: boolean
  setSlope: (v: boolean) => void
  inchesOverride: string
  setInchesOverride: (v: string) => void
  plan: ReturnType<typeof planIrrigation>
  hasArea: boolean
}) {
  const { plan, beginner } = props
  const lawnHead = HEAD_TYPES.find((h) => h.value === props.head) ?? HEAD_TYPES[0]

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex flex-col gap-6">
          {/* Areas */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                2 — What are you watering?
              </p>
            </div>
            <div className="flex flex-col gap-6 p-5">
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium">Lawn / turf</p>
                <AreaBuilder
                  idPrefix="irr-lawn"
                  label="Lawn area"
                  hint="Only the grass that sprinklers actually cover — leave out driveways and patios."
                  mode={props.lawnMode}
                  setMode={props.setLawnMode}
                  shapes={props.lawnShapes}
                  setShapes={props.setLawnShapes}
                  knownArea={props.lawnKnown}
                  setKnownArea={props.setLawnKnown}
                  beginner={beginner}
                  area={props.lawnArea}
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-6">
                <p className="text-sm font-medium">Planting beds</p>
                <AreaBuilder
                  idPrefix="irr-bed"
                  label="Bed area"
                  hint="Beds and borders are watered separately from turf because they need far less."
                  mode={props.bedMode}
                  setMode={props.setBedMode}
                  shapes={props.bedShapes}
                  setShapes={props.setBedShapes}
                  knownArea={props.bedKnown}
                  setKnownArea={props.setBedKnown}
                  beginner={beginner}
                  area={props.bedArea}
                />
              </div>

              <Field
                label="ZIP code"
                htmlFor="irr-zip"
                hint={
                  plan.isRegionFallback
                    ? "Sets the weekly water requirement for your climate. Without it we use the national average."
                    : `${plan.region.stateName} needs about ${n1(plan.weeklyInches)} in of water per week in peak season.`
                }
              >
                <Input
                  id="irr-zip"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="e.g. 85001"
                  value={props.zip}
                  onChange={(e) => props.setZip(e.target.value)}
                />
              </Field>
            </div>
          </div>

          {/* System */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                3 — Your water & sprinklers
              </p>
            </div>
            <div className="flex flex-col gap-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Water source"
                  htmlFor="irr-source"
                  hint="Sets the assumed flow when you don't know your GPM."
                >
                  <select
                    id="irr-source"
                    className={selectClass}
                    value={props.source}
                    onChange={(e) => props.setSource(e.target.value as WaterSource)}
                  >
                    {(Object.keys(SOURCE_LABELS) as WaterSource[]).map((k) => (
                      <option key={k} value={k}>
                        {SOURCE_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Flow rate (optional)"
                  htmlFor="irr-gpm"
                  hint="Time how long a 5 gallon bucket takes to fill from an outside spigot: 5 / seconds x 60 = GPM."
                >
                  <div className="relative">
                    <Input
                      id="irr-gpm"
                      inputMode="decimal"
                      className="pr-14"
                      placeholder={String(plan.availableGpm)}
                      value={props.gpm}
                      onChange={(e) => props.setGpm(e.target.value)}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      GPM
                    </span>
                  </div>
                </Field>
              </div>

              <Field
                label="Lawn sprinkler type"
                htmlFor="irr-head"
                hint={lawnHead.note}
              >
                <select
                  id="irr-head"
                  className={selectClass}
                  value={props.head}
                  onChange={(e) => props.setHead(e.target.value)}
                >
                  {HEAD_TYPES.map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label} — {n1(h.precipRate)} in/hr
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Watering frequency"
                hint="Deep and infrequent beats a little every day. Two or three sessions a week suits most lawns."
              >
                <Segmented
                  ariaLabel="Waterings per week"
                  value={String(props.frequency)}
                  onChange={(v) => props.setFrequency(Number(v))}
                  options={[2, 3, 4, 5, 7].map((f) => ({
                    value: String(f),
                    label: f === 7 ? "Daily" : `${f}x / week`,
                  }))}
                />
              </Field>

              {!beginner ? (
                <div className="flex flex-col gap-5 border-t border-border pt-5">
                  <Field
                    label="Bed emitter type"
                    htmlFor="irr-bedhead"
                    hint="Beds run on their own zone. Drip is roughly 90% efficient versus 70% for spray."
                  >
                    <select
                      id="irr-bedhead"
                      className={selectClass}
                      value={props.bedHead}
                      onChange={(e) => props.setBedHead(e.target.value)}
                    >
                      {HEAD_TYPES.map((h) => (
                        <option key={h.value} value={h.value}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Soil type"
                      htmlFor="irr-soil"
                      hint="Controls how fast water can go on before it runs off instead of soaking in."
                    >
                      <select
                        id="irr-soil"
                        className={selectClass}
                        value={props.soil}
                        onChange={(e) => props.setSoil(e.target.value as SoilType)}
                      >
                        {(Object.keys(SOIL_LABELS) as SoilType[]).map((k) => (
                          <option key={k} value={k}>
                            {SOIL_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field
                      label="Weekly requirement override"
                      htmlFor="irr-inches"
                      hint="Leave blank to use the regional figure. Enter your own if you track ET locally."
                    >
                      <div className="relative">
                        <Input
                          id="irr-inches"
                          inputMode="decimal"
                          className="pr-16"
                          placeholder={n1(plan.weeklyInches)}
                          value={props.inchesOverride}
                          onChange={(e) => props.setInchesOverride(e.target.value)}
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          in/wk
                        </span>
                      </div>
                    </Field>
                  </div>

                  <label className="flex items-start gap-3 rounded-md border border-input bg-background p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={props.slope}
                      onChange={(e) => props.setSlope(e.target.checked)}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">The area slopes noticeably</span>
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        Slopes shed water before it soaks in, so runtimes get split into shorter
                        cycles.
                      </span>
                    </span>
                  </label>
                </div>
              ) : (
                <p className="flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  Beds are planned on drip in average loam soil. Switch to Advanced to set soil
                  type, bed emitters, slope and your own weekly requirement.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sticky answer — top-20 clears the 4rem sticky navbar with a small buffer */}
        <div className="lg:sticky lg:top-20">
          {!props.hasArea ? (
            <div className="rounded-lg border border-dashed border-border bg-card px-5 py-10 text-center">
              <Droplets className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-2 font-serif text-lg font-semibold">Your schedule appears here</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Enter a lawn or bed area and we'll size the zones, runtimes and gallons.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border border-primary bg-primary/10 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Weekly water use
                </p>
                <p className="mt-2 font-serif text-4xl font-semibold leading-none tabular-nums">
                  {int(plan.weeklyGallons)}
                </p>
                <p className="mt-2 text-sm text-foreground">
                  gallons a week across {plan.zoneCount} zone{plan.zoneCount === 1 ? "" : "s"}
                </p>
                <p className="mt-3 border-t border-primary/20 pt-3 text-xs leading-relaxed text-muted-foreground">
                  {n1(plan.weeklyInches)} in per week · about {money(plan.monthlyCost)} a month in
                  peak season
                </p>
              </div>

              <Panel
                title="Your watering schedule"
                icon={<Droplets className="size-4 text-primary" aria-hidden="true" />}
              >
                <ul className="flex flex-col gap-3">
                  {plan.zones.map((z) => (
                    <li key={z.name} className="flex flex-col gap-0.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-foreground">{z.name}</span>
                        <span className="shrink-0 font-serif text-lg font-semibold tabular-nums">
                          {int(z.runtimeMin)} min
                        </span>
                      </div>
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {int(z.area)} sq ft · {z.heads} head{z.heads === 1 ? "" : "s"} ·{" "}
                        {n1(z.gpm)} GPM · {int(z.gallonsPerRun)} gal per run
                        {z.cycles > 1
                          ? ` · split into ${z.cycles} cycles of ${int(z.runtimeMin / z.cycles)} min`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                  Run all zones {props.frequency === 7 ? "daily" : `${props.frequency}x a week`}.
                  Total station time is {int(plan.totalRuntimeMin)} minutes per cycle, so start the
                  program by {startTime(plan.totalRuntimeMin)} to finish before 8 a.m.
                </p>
              </Panel>
            </div>
          )}
        </div>
      </div>

      {props.hasArea ? (
        <>
          {plan.warnings.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-5">
              <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
                <TriangleAlert className="size-4 text-primary" aria-hidden="true" />
                Runoff warning
              </h3>
              <ul className="flex flex-col gap-2">
                {plan.warnings.map((w) => (
                  <li key={w} className="text-sm leading-relaxed text-muted-foreground">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Panel
            title="Every number, broken out"
            icon={<Gauge className="size-4 text-primary" aria-hidden="true" />}
          >
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {plan.metrics.map((m) => (
                <Stat
                  key={m.label}
                  label={m.label}
                  value={m.value}
                  sub={m.hint}
                  emphasis={m.emphasis}
                />
              ))}
            </div>
          </Panel>

          <div className="grid gap-6 md:grid-cols-2">
            <Panel
              title="How we got there"
              icon={<Calculator className="size-4 text-primary" aria-hidden="true" />}
            >
              <ol className="flex flex-col gap-3">
                {plan.steps.map((s) => (
                  <li key={s.label} className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">{s.label}</span>
                    <span className="text-sm leading-relaxed tabular-nums text-muted-foreground">
                      {s.detail}
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>

            <Panel
              title="Water smarter"
              icon={<Lightbulb className="size-4 text-primary" aria-hidden="true" />}
            >
              <ul className="flex flex-col gap-3">
                {plan.tips.map((t) => (
                  <li key={t} className="text-sm leading-relaxed text-muted-foreground">
                    {t}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Zone counts assume head-to-head spacing and that your supply feeds one zone at a time.
            A real design also accounts for pipe size, pressure loss and backflow requirements —
            verify with a catch-can test once the system runs.
          </p>
        </>
      ) : null}
    </>
  )
}

/** Latest clock time a program can start and still finish by 8 a.m. */
function startTime(totalMinutes: number): string {
  const end = 8 * 60
  const start = Math.max(0, end - Math.round(totalMinutes))
  const h = Math.floor(start / 60)
  const m = start % 60
  const suffix = h < 12 ? "a.m." : "p.m."
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`
}

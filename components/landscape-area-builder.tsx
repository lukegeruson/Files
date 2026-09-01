"use client"

// Shared area measurer for the materials planner. Homeowners rarely have a
// clean rectangle, so this supports adding as many rectangles, circles and
// triangles as the yard needs and sums them into one square footage.

import { Plus, Square, Circle, Triangle, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Field, Segmented, selectClass } from "@/components/calculator-ui"
import { cn } from "@/lib/utils"
import {
  SHAPE_FIELDS,
  SHAPE_LABELS,
  describeShape,
  shapeArea,
  type Shape,
  type ShapeKind,
} from "@/lib/landscape-materials"

const SHAPE_ICON: Record<ShapeKind, React.ReactNode> = {
  rect: <Square className="size-3.5" aria-hidden="true" />,
  circle: <Circle className="size-3.5" aria-hidden="true" />,
  triangle: <Triangle className="size-3.5" aria-hidden="true" />,
}

let shapeSeq = 0
export function newShape(kind: ShapeKind = "rect"): Shape {
  shapeSeq += 1
  return { id: `s${shapeSeq}`, kind, a: 0, b: 0 }
}

const int = (v: number) => Math.round(v).toLocaleString("en-US")

export type AreaMode = "measure" | "known"

export function AreaBuilder({
  idPrefix,
  label,
  hint,
  mode,
  setMode,
  shapes,
  setShapes,
  knownArea,
  setKnownArea,
  beginner,
  area,
}: {
  idPrefix: string
  label: string
  hint?: string
  mode: AreaMode
  setMode: (m: AreaMode) => void
  shapes: Shape[]
  setShapes: (s: Shape[]) => void
  knownArea: string
  setKnownArea: (v: string) => void
  beginner: boolean
  area: number
}) {
  function update(id: string, patch: Partial<Shape>) {
    setShapes(shapes.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label={label} hint={hint}>
        <Segmented
          ariaLabel={`${label} entry method`}
          value={mode}
          onChange={setMode}
          options={[
            { value: "measure" as AreaMode, label: "Measure the shape" },
            { value: "known" as AreaMode, label: "I know the square footage" },
          ]}
        />
      </Field>

      {mode === "known" ? (
        <Field
          label="Area"
          htmlFor={`${idPrefix}-known`}
          hint="Enter the total square footage you already worked out."
        >
          <div className="relative">
            <Input
              id={`${idPrefix}-known`}
              inputMode="decimal"
              className="pr-14"
              placeholder="500"
              value={knownArea}
              onChange={(e) => setKnownArea(e.target.value)}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              sq ft
            </span>
          </div>
        </Field>
      ) : (
        <div className="flex flex-col gap-3">
          {shapes.map((shape, i) => {
            const spec = SHAPE_FIELDS[shape.kind]
            const sub = shapeArea(shape)
            return (
              <div
                key={shape.id}
                className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {SHAPE_ICON[shape.kind]}
                    Area {i + 1}
                  </span>
                  {shapes.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setShapes(shapes.filter((s) => s.id !== shape.id))}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                    >
                      <X className="size-3" aria-hidden="true" />
                      Remove
                      <span className="sr-only">area {i + 1}</span>
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Shape" htmlFor={`${idPrefix}-kind-${shape.id}`}>
                    <select
                      id={`${idPrefix}-kind-${shape.id}`}
                      className={selectClass}
                      value={shape.kind}
                      onChange={(e) => update(shape.id, { kind: e.target.value as ShapeKind })}
                    >
                      {(Object.keys(SHAPE_LABELS) as ShapeKind[]).map((k) => (
                        <option key={k} value={k}>
                          {SHAPE_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label={spec.a} htmlFor={`${idPrefix}-a-${shape.id}`}>
                    <Input
                      id={`${idPrefix}-a-${shape.id}`}
                      inputMode="decimal"
                      placeholder="0"
                      value={shape.a || ""}
                      onChange={(e) => update(shape.id, { a: Number.parseFloat(e.target.value) || 0 })}
                    />
                  </Field>

                  {spec.b ? (
                    <Field label={spec.b} htmlFor={`${idPrefix}-b-${shape.id}`}>
                      <Input
                        id={`${idPrefix}-b-${shape.id}`}
                        inputMode="decimal"
                        placeholder="0"
                        value={shape.b || ""}
                        onChange={(e) => update(shape.id, { b: Number.parseFloat(e.target.value) || 0 })}
                      />
                    </Field>
                  ) : (
                    <div className="flex items-end">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        A circle only needs one measurement.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground">
                    {sub > 0 ? describeShape(shape) : "Enter the measurements above"}
                  </span>
                  <span className="font-serif text-sm tabular-nums">
                    {sub > 0 ? `${int(sub)} sq ft` : "—"}
                  </span>
                </div>

                {beginner ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">{spec.help}</p>
                ) : null}
              </div>
            )
          })}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShapes([...shapes, newShape()])}
              className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add another area
            </button>
            <span
              className={cn(
                "text-sm tabular-nums",
                area > 0 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              Total:{" "}
              <span className="font-serif text-base font-semibold">{int(area)} sq ft</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Shared select options for the opening form. SERVER ONLY.
//
// Built here rather than imported by the client component so the taxonomy stays
// on the server: `careers.ts` alone is ~2,300 lines, and the form only needs an
// id, a name, and a trade from it.

import { CAREERS } from "@/lib/careers/careers"
import { CAREER_LEVEL_LABELS } from "@/lib/careers/types"
import { EMPLOYMENT_TYPES, PAY_PERIODS } from "@/lib/careers/postings"
import { STATE_NAMES } from "@/lib/zip"
import type { CareerOption } from "@/components/careers/opening-form"

export const careerOptions: CareerOption[] = CAREERS.map((career) => ({
  id: career.id,
  name: career.name,
  industry: career.industry,
  level: CAREER_LEVEL_LABELS[career.level],
}))

export const stateOptions = Object.entries(STATE_NAMES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.code.localeCompare(b.code))

export const employmentTypeOptions = Object.entries(EMPLOYMENT_TYPES).map(
  ([value, meta]) => ({ value, label: meta.label }),
)

export const payPeriodOptions = Object.entries(PAY_PERIODS).map(
  ([value, meta]) => ({ value, label: meta.label }),
)

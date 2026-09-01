"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Building2, MapPin, Search, SlidersHorizontal } from "lucide-react"
import { useProfile } from "@/lib/careers/use-profile"
import { getMatches, hasEnoughAnswers } from "@/lib/careers/matching"
import { getCareer } from "@/lib/careers/careers"
import {
  COMPANIES,
  isValidZip,
  searchCompanies,
  type CompanyResult,
} from "@/lib/careers/companies"
import {
  stateCodeForZip,
  stateNameForZip,
  type Box,
  type JobPin,
  type StatePath,
} from "@/lib/careers/job-map-shared"
import { IndustryTag } from "./career-bits"
import { JobMap } from "./job-map"
import { RoadMarker, RoadRail } from "./road-rail"

/** How many ranked careers count as "roles you're aiming at". */
const MATCH_DEPTH = 12

/** The three stops on the road rail, nearest first. */
type RoadBand = "city" | "state" | "away"

/**
 * Distances are deliberately written as approximations. Proximity here comes
 * from ZIP structure and state codes, not geocoding, so a precise mileage would
 * be invented — these are the rough scale of each band, not a measured figure.
 */
const BAND_META: Record<RoadBand, { label: string; distance: string }> = {
  city: { label: "Same city", distance: "~10 mi" },
  state: { label: "Same state", distance: "~100 mi" },
  away: { label: "Different state", distance: "100+ mi" },
}

/**
 * Geometry for the job map, projected on the server so d3-geo and the state
 * atlas stay out of the client bundle.
 */
export type JobMapData = {
  statePaths: StatePath[]
  stateBoxes: Record<string, Box>
  pins: JobPin[]
  /** How many pins are real openings rather than seeded samples. */
  liveCount: number
}

export function CompanySearch({ map }: { map: JobMapData }) {
  const { profile, hydrated } = useProfile()
  const [zip, setZip] = useState("")
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [matchesOnly, setMatchesOnly] = useState(false)

  // Career ids the user is aiming at: their ranked quiz matches plus anything
  // they explicitly saved from the skill tree.
  const matchedCareerIds = useMemo(() => {
    if (!hydrated) return []
    const ranked = hasEnoughAnswers(profile.answers)
      ? getMatches(profile.answers, MATCH_DEPTH).map((m) => m.career.id)
      : []
    return [...new Set([...ranked, ...profile.savedCareers])]
  }, [hydrated, profile.answers, profile.savedCareers])

  const hasCriteria = matchedCareerIds.length > 0

  // Names of the roles explicitly saved from the Skill Tree. The tree's own
  // click-to-open selection is ephemeral local state, so saved roles are the
  // only durable "selection" there is to name here.
  const savedNames = useMemo(() => {
    if (!hydrated) return []
    return profile.savedCareers
      .map((id) => getCareer(id)?.name)
      .filter((name): name is string => Boolean(name))
  }, [hydrated, profile.savedCareers])

  // Someone can reach `hasCriteria` through quiz answers alone, with nothing
  // saved — naming a "selection" they never made would be wrong, so that case
  // gets its own wording.
  const selectionLabel =
    savedNames.length === 1
      ? savedNames[0]
      : savedNames.length > 1
        ? `${savedNames[0]} +${savedNames.length - 1} more`
        : null

  const results = useMemo(
    () => (submitted ? searchCompanies(submitted, matchedCareerIds) : []),
    [submitted, matchedCareerIds],
  )

  const visible = matchesOnly
    ? results.filter((r) => r.matchingRoles.length > 0)
    : results

  // The state the submitted ZIP falls in, used to zoom the map and to label
  // it. Null for ZIPs outside the seeded sample, where we stay national.
  const activeStateName = useMemo(
    () => (submitted ? stateNameForZip(submitted) : null),
    [submitted],
  )

  const invalid = zip.trim().length > 0 && !isValidZip(zip)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidZip(zip)) return
    setSubmitted(zip.trim())
  }

  // Group by travel band so the headings carry the geography rather than every
  // card repeating it. Three bands, matching the stops on the road rail.
  const groups = useMemo(() => {
    const searchedState = submitted ? stateCodeForZip(submitted) : null

    const bandFor = (result: CompanyResult): RoadBand => {
      // Shared 3-digit prefix is the same sectional centre, i.e. same city or
      // metro. This is the one band ZIP structure alone can settle.
      if (result.proximity === "exact" || result.proximity === "near") return "city"
      // Compare real state codes rather than the first ZIP digit, which spans
      // state lines (digit 8 covers both Colorado and west Texas). Falls back
      // to the digit only for ZIPs outside the range table.
      if (searchedState) {
        return result.company.state === searchedState ? "state" : "away"
      }
      return result.proximity === "region" ? "state" : "away"
    }

    const order: RoadBand[] = ["city", "state", "away"]
    const bands = new Map<RoadBand, CompanyResult[]>()
    for (const result of visible) {
      const band = bandFor(result)
      const bucket = bands.get(band)
      if (bucket) bucket.push(result)
      else bands.set(band, [result])
    }

    return order
      .map((band) => ({ band, items: bands.get(band) ?? [] }))
      .filter((group) => group.items.length > 0)
  }, [visible, submitted])

  return (
    <section className="mx-auto max-w-6xl px-4 md:px-6">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label htmlFor="zip" className="block text-sm font-medium">
            Your ZIP code
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring">
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              id="zip"
              name="zip"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 95814"
              aria-invalid={invalid}
              aria-describedby={invalid ? "zip-error" : "zip-hint"}
              className="min-h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          {invalid ? (
            <p id="zip-error" role="alert" className="mt-2 text-sm text-destructive">
              Enter a 5-digit ZIP code.
            </p>
          ) : (
            <p id="zip-hint" className="mt-2 text-sm text-muted-foreground">
              We show the closest employers first, based on ZIP proximity.
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={!isValidZip(zip)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:mt-8"
        >
          <Search className="size-4" aria-hidden="true" />
          Find companies
        </button>
      </form>

      {/* The map renders immediately rather than waiting on a ZIP: it carries
          every seeded opening nationally, so it is browsable on its own and
          gives the page something to explore before any input. Submitting a ZIP
          re-frames it to that state instead of revealing it. */}
      <div className="mt-10">
        <div className="border-b border-border pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-serif text-xl font-semibold tracking-tight">
              Openings across the country
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeStateName
                ? `Starting in ${activeStateName}`
                : "Showing the whole country"}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <JobMap
            statePaths={map.statePaths}
            stateBoxes={map.stateBoxes}
            pins={map.pins}
            // Empty until a search runs. JobMap uses this only to detect a new
            // submission and re-frame, so "" simply means "stay national".
            zip={submitted ?? ""}
            activeStateName={activeStateName}
            matchedCareerIds={matchedCareerIds}
          />
        </div>
      </div>

      {submitted ? (
        <div className="mt-14">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <h2 className="font-serif text-xl font-semibold tracking-tight">
              {visible.length} {visible.length === 1 ? "company" : "companies"} near {submitted}
            </h2>
            {hasCriteria ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <SlidersHorizontal
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    type="checkbox"
                    checked={matchesOnly}
                    onChange={(e) => setMatchesOnly(e.target.checked)}
                    className="size-4 rounded border-border accent-primary"
                  />
                  {selectionLabel ? (
                    <span>
                      Only roles matching my selection:{" "}
                      {/* title carries the full list when it is abbreviated. */}
                      <span
                        className="font-medium text-foreground"
                        title={savedNames.length > 1 ? savedNames.join(", ") : undefined}
                      >
                        {selectionLabel}
                      </span>
                    </span>
                  ) : (
                    <span>Only roles matching my quiz results</span>
                  )}
                </label>
                {/* Outside the label on purpose: nested inside it, clicking
                    this would also toggle the checkbox. */}
                <Link
                  href="/jobs/tree"
                  className="inline-flex min-h-9 items-center rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  Change selection
                </Link>
              </div>
            ) : null}
          </div>

          {/* Without quiz answers there is nothing to rank against, so say what
              would improve the results instead of silently showing a flat list. */}
          {hydrated && !hasCriteria ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              These are unranked.{" "}
              <Link href="/jobs/quiz?view=quiz" className="font-medium text-primary hover:underline">
                Take the quiz
              </Link>{" "}
              or save roles in the{" "}
              <Link href="/jobs/tree" className="font-medium text-primary hover:underline">
                Skill Tree
              </Link>{" "}
              and we will highlight the employers hiring for your roles.
            </p>
          ) : null}

          {visible.length === 0 ? (
            <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-6">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {matchesOnly
                  ? "No employers near that ZIP are hiring for your matched roles. Clear the filter to see everyone in the area."
                  : "Nothing in our directory near that ZIP yet. This is a small sample set — try a different ZIP, explore the map above, or check the Evergreen roles below."}
              </p>
            </div>
          ) : (
            /* The rail is absolutely positioned across the whole run of bands,
               so the road stays continuous through the gaps between them. Each
               band pads itself clear of the rail rather than the wrapper doing
               it, which keeps `left-0` inside a band aligned to the road. */
            <div className="relative mt-8">
              <RoadRail segmentCount={groups.length} />
              <div className="flex flex-col gap-10">
                {groups.map((group) => (
                  <div key={group.band} className="relative lg:pl-20">
                    <RoadMarker
                      distance={BAND_META[group.band].distance}
                      flight={group.band === "away"}
                    />
                    <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      {BAND_META[group.band].label}
                    </h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {group.items.map((result) => (
                        <CompanyCard key={result.company.id} result={result} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

function CompanyCard({ result }: { result: CompanyResult }) {
  const { company, matchingRoles } = result
  const matched = new Set(matchingRoles)
  // Matched roles first so the relevant ones are visible without scanning.
  const roles = [...company.hiringFor].sort(
    (a, b) => Number(matched.has(b)) - Number(matched.has(a)),
  )

  return (
    <article className="flex flex-col rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-serif text-lg font-semibold leading-snug">{company.name}</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {company.city}, {company.state} {company.zip} · {company.size}
          </p>
        </div>
        {matchingRoles.length > 0 ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {matchingRoles.length} match{matchingRoles.length === 1 ? "" : "es"}
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {company.industries.map((industry) => (
          <IndustryTag key={industry} industry={industry} />
        ))}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{company.blurb}</p>

      <div className="mt-4">
        <h5 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Hiring for
        </h5>
        <ul className="mt-2 flex flex-wrap gap-2">
          {roles.map((id) => {
            const career = getCareer(id)
            if (!career) return null
            const isMatch = matched.has(id)
            return (
              <li key={id}>
                <Link
                  href={`/jobs/careers/${id}`}
                  className={
                    isMatch
                      ? "inline-flex items-center rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                      : "inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  }
                >
                  {career.name}
                  {isMatch ? <span className="sr-only"> (matches your profile)</span> : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </article>
  )
}

/**
 * Scope note for the directory, shown above the search.
 *
 * The state list is derived rather than written out. A hardcoded sentence goes
 * stale the moment an opening is posted somewhere new, and a wrong claim about
 * coverage is worse than a vaguer true one.
 */
export function CompanySearchIntro({ liveCount = 0 }: { liveCount?: number }) {
  const samples = COMPANIES.filter((c) => !c.isEvergreen)
  const stateCount = new Set(samples.map((c) => c.state)).size

  return (
    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Building2 className="size-4 shrink-0" aria-hidden="true" />
      {liveCount > 0 ? (
        <span>
          {liveCount} live {liveCount === 1 ? "opening" : "openings"}, plus a
          sample directory of {samples.length} illustrative employers across{" "}
          {stateCount} states.
        </span>
      ) : (
        <span>
          Sample directory of {samples.length} employers across {stateCount}{" "}
          states.
        </span>
      )}
    </p>
  )
}

import Link from "next/link"
import { notFound } from "next/navigation"
import { updateOpeningAction } from "@/app/actions/openings"
import { OpeningForm } from "@/components/careers/opening-form"
import { requireAdmin } from "@/lib/admin-auth"
import { getPosting } from "@/lib/careers/postings"
import { isMappable } from "@/lib/careers/job-map"
import type { Industry } from "@/lib/careers/types"
import {
  careerOptions,
  employmentTypeOptions,
  payPeriodOptions,
  stateOptions,
} from "../../options"

export const metadata = {
  title: "Edit opening — Evergreen Admin",
  robots: { index: false, follow: false },
}

export default async function EditOpeningPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()

  const { id } = await params
  const row = await getPosting(id)
  if (!row) notFound()

  const action = updateOpeningAction.bind(null, row.id)

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <Link
        href="/admin/openings"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to openings
      </Link>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
        Edit opening
      </h1>

      {/* The one thing about this row that is not visible in the fields below. */}
      {!isMappable(row.lng, row.lat) ? (
        <p className="mt-4 rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          This ZIP sits outside the map projection, so this opening is listed
          below the map rather than pinned on it. Puerto Rico, Guam, the US
          Virgin Islands and American Samoa are all in this position.
        </p>
      ) : null}

      <div className="mt-8">
        <OpeningForm
          action={action}
          careers={careerOptions}
          states={stateOptions}
          employmentTypes={employmentTypeOptions}
          payPeriods={payPeriodOptions}
          submitLabel="Save changes"
          defaults={{
            title: row.title,
            careerId: row.careerId,
            industry: row.industry as Industry,
            employer: row.employer,
            city: row.city,
            state: row.state,
            zip: row.zip,
            employmentType: row.employmentType,
            description: row.description,
            payMin: row.payMin,
            payMax: row.payMax,
            payPeriod: row.payPeriod,
            applyUrl: row.applyUrl,
            applyEmail: row.applyEmail,
            published: row.published,
            // Stored end-of-day UTC, so read the date back in UTC too — local
            // formatting would shift a closing date back a day west of GMT.
            expiresOn: row.expiresAt
              ? row.expiresAt.toISOString().slice(0, 10)
              : "",
          }}
        />
      </div>
    </div>
  )
}

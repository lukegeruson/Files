import Link from "next/link"
import { createOpeningAction } from "@/app/actions/openings"
import { OpeningForm } from "@/components/careers/opening-form"
import { requireAdmin } from "@/lib/admin-auth"
import { getEvergreen } from "@/lib/careers/companies"
import {
  careerOptions,
  employmentTypeOptions,
  payPeriodOptions,
  stateOptions,
} from "../options"

export const metadata = {
  title: "New opening — Evergreen Admin",
  robots: { index: false, follow: false },
}

export default async function NewOpeningPage() {
  await requireAdmin()

  // Prefill with our own details, since most postings will be ours. Every field
  // stays editable so a posting for another employer is no harder to enter.
  const us = getEvergreen()

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <Link
        href="/admin/openings"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to openings
      </Link>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
        New opening
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Published openings appear as solid pins on the public map and in search
        results. Save as a draft to hold it back.
      </p>

      <div className="mt-8">
        <OpeningForm
          action={createOpeningAction}
          careers={careerOptions}
          states={stateOptions}
          employmentTypes={employmentTypeOptions}
          payPeriods={payPeriodOptions}
          submitLabel="Create opening"
          defaults={{
            title: "",
            careerId: null,
            industry: "solar",
            employer: us?.name ?? "",
            city: us?.city ?? "",
            state: us?.state ?? "CA",
            zip: us?.zip ?? "",
            employmentType: "full_time",
            description: "",
            payMin: null,
            payMax: null,
            payPeriod: "hour",
            applyUrl: null,
            applyEmail: null,
            // Unpublished by default: a half-written posting going live the
            // moment it is saved is the more damaging mistake of the two.
            published: false,
            expiresOn: "",
          }}
        />
      </div>
    </div>
  )
}

import Link from "next/link"
import { ArrowUpRight, MapPinOff, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeleteOpeningButton } from "@/components/careers/delete-opening-button"
import { requireAdmin } from "@/lib/admin-auth"
import { careerName } from "@/lib/careers/careers"
import { INDUSTRY_META } from "@/lib/careers/industries"
import {
  employmentLabel,
  getAllPostings,
  isExpired,
  payLabel,
} from "@/lib/careers/postings"
import { isMappable } from "@/lib/careers/job-map"
import type { Industry } from "@/lib/careers/types"

export const metadata = {
  title: "Openings — Evergreen Admin",
  robots: { index: false, follow: false },
}

/** Draft / Live / Expired, since the last of those is invisible but not gone. */
function statusOf(row: {
  published: boolean
  expiresAt: Date | null
}): { label: string; className: string } {
  if (!row.published) {
    return { label: "Draft", className: "bg-muted text-muted-foreground" }
  }
  if (isExpired(row as never)) {
    return {
      label: "Expired",
      className: "bg-destructive/15 text-destructive",
    }
  }
  return { label: "Live", className: "bg-primary/15 text-primary" }
}

export default async function AdminOpeningsPage() {
  await requireAdmin()

  const rows = await getAllPostings()
  const liveCount = rows.filter(
    (row) => row.published && !isExpired(row),
  ).length

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to content
          </Link>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
            Openings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} total · {liveCount} live on the public map
          </p>
        </div>
        <Button
          nativeButton={false}
          render={
            <Link href="/admin/openings/new">
              <Plus className="size-4" />
              New opening
            </Link>
          }
        />
      </div>

      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        These are real jobs people can apply to, shown as solid pins on{" "}
        <Link href="/jobs/openings" className="text-primary underline">
          the openings map
        </Link>
        . They are separate from the sample employer directory, which is
        illustrative only.
      </p>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No openings yet. The public map shows only sample employers until you
          add one.
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Location
                </th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  Status
                </th>
                <th className="px-2 py-3 text-right font-medium sm:px-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = statusOf(row)
                const pay = payLabel(row)
                const industry = row.industry as Industry
                const trade = INDUSTRY_META[industry]?.label ?? row.industry
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="w-full py-3 pl-4 pr-2 sm:pr-4">
                      <span className="font-medium">{row.title}</span>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.employer} · {trade} ·{" "}
                        {employmentLabel(row.employmentType)}
                        {pay ? ` · ${pay}` : " · pay not disclosed"}
                      </div>
                      {row.careerId ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Matched to {careerName(row.careerId)}
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Not matched to a skill-tree role
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row.city}, {row.state} {row.zip}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 align-top text-muted-foreground md:table-cell">
                      <div className="whitespace-nowrap">
                        {row.city}, {row.state}
                      </div>
                      <div className="text-xs">{row.zip}</div>
                      {/* Albers USA cannot place the territories, so these rows
                          are list-only. Flagged here rather than leaving the
                          admin to wonder why no pin appeared. */}
                      {!isMappable(row.lng, row.lat) ? (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPinOff className="size-3" aria-hidden="true" />
                          List only
                        </div>
                      ) : null}
                    </td>
                    <td className="hidden px-4 py-3 align-top sm:table-cell">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-2 py-3 align-top sm:px-4">
                      <div className="flex items-center justify-end gap-1.5 sm:gap-2">
                        {row.published && !isExpired(row) ? (
                          <Link
                            href="/jobs/openings"
                            aria-label={`View ${row.title} on the public map`}
                            className="inline-flex size-9 items-center justify-center gap-1.5 rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground sm:size-auto sm:px-2.5 sm:py-1.5 sm:text-sm"
                          >
                            <ArrowUpRight className="size-4 shrink-0" />
                            <span className="hidden sm:inline">View</span>
                          </Link>
                        ) : null}
                        <Link
                          href={`/admin/openings/${row.id}/edit`}
                          aria-label={`Edit ${row.title}`}
                          className="inline-flex size-9 items-center justify-center gap-1.5 rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground sm:size-auto sm:px-2.5 sm:py-1.5 sm:text-sm"
                        >
                          <Pencil className="size-4 shrink-0" />
                          <span className="hidden sm:inline">Edit</span>
                        </Link>
                        <DeleteOpeningButton id={row.id} title={row.title} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

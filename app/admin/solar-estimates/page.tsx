import Link from "next/link"
import { Inbox } from "lucide-react"
import {
  deleteSolarEstimate,
  listSolarEstimates,
  setSolarEstimateRead,
} from "@/app/actions/solar-estimates"
import {
  RecordDeleteButton,
  RecordReadToggle,
} from "@/components/admin/inbox-record-actions"
import { requireAdmin } from "@/lib/admin-auth"
import {
  ORIENTATION_LABELS,
  PAYMENT_LABELS,
  ROOF_CONDITION_LABELS,
  ROOF_TYPE_LABELS,
  SHADE_LABELS,
  money,
  years as fmtYears,
} from "@/lib/solar"

export const metadata = {
  title: "Solar estimates — Evergreen",
  robots: { index: false, follow: false },
}

function formatReceived(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}

function label<T extends string>(labels: Record<T, string>, value: T): string {
  return labels[value] ?? value
}

export default async function AdminSolarEstimatesPage() {
  await requireAdmin()

  const estimates = await listSolarEstimates()
  const unread = estimates.filter((e) => e.readAt === null).length

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to admin
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Solar estimates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {estimates.length === 0
            ? "No estimates yet"
            : `${estimates.length} ${estimates.length === 1 ? "estimate" : "estimates"}, ${unread} to follow up`}
        </p>
      </div>

      <p className="mt-6 rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
        Everyone who unlocks the solar savings calculator lands here with their contact details,
        every answer they gave, and the results they saw.
      </p>

      {estimates.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border px-4 py-12 text-center">
          <Inbox className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            When someone unlocks their results, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {estimates.map((e) => {
            const isRead = e.readAt !== null
            const i = e.inputs
            const answers: Array<[string, string]> = [
              ["ZIP", i.zip],
              ["Monthly bill", money(i.monthlyBill)],
              ["Monthly usage", i.monthlyKwh ? `${i.monthlyKwh} kWh` : "Not given"],
              ["Rate", i.rate ? `$${i.rate}/kWh` : "State average"],
              ["Utility", i.utility || "Not given"],
              ["Roof condition", label(ROOF_CONDITION_LABELS, i.roofCondition)],
              ["Roof type", label(ROOF_TYPE_LABELS, i.roofType)],
              ["Orientation", label(ORIENTATION_LABELS, i.orientation)],
              ["Shade", label(SHADE_LABELS, i.shade)],
              ["EV", i.hasEv ? "Yes" : "No"],
              ["Battery", i.wantsBattery ? "Yes" : "No"],
              ["Years in home", String(i.yearsInHome)],
              ["Payment", label(PAYMENT_LABELS, i.payment)],
            ]
            const results: Array<[string, string]> = [
              ["System", `${e.systemKw.toFixed(1)} kW · ${e.panelCount} panels`],
              ["Net cost", money(e.netCost)],
              ["Monthly savings", money(e.monthlySavings)],
              ["Payback", fmtYears(e.paybackYears)],
              ["ROI", `${Math.round(e.roiPercent)}%`],
              ["Lifetime gain", money(e.netLifetimeGain)],
            ]
            return (
              <li
                key={e.id}
                className={`rounded-xl border p-5 ${
                  isRead ? "border-border bg-card" : "border-primary/40 bg-card"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-lg font-semibold tracking-tight">{e.name}</h2>
                      {isRead ? null : (
                        <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                          New
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <a href={`mailto:${e.email}`} className="break-all text-primary">
                        {e.email}
                      </a>
                      <a href={`tel:${e.phone.replace(/[^\d+]/g, "")}`} className="text-primary">
                        {e.phone}
                      </a>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatReceived(e.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RecordReadToggle
                      id={e.id}
                      read={isRead}
                      label={`estimate from ${e.name}`}
                      toggleAction={setSolarEstimateRead}
                    />
                    <RecordDeleteButton
                      id={e.id}
                      label={`estimate from ${e.name}`}
                      deleteAction={deleteSolarEstimate}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Results
                    </h3>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {results.map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs text-muted-foreground">{k}</dt>
                          <dd className="font-medium tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Calculator answers
                    </h3>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {answers.map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs text-muted-foreground">{k}</dt>
                          <dd className="break-words">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

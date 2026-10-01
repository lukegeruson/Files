import Link from "next/link"
import { Inbox } from "lucide-react"
import {
  countLeadsBySource,
  deleteLead,
  listLeads,
  setLeadRead,
} from "@/app/actions/leads"
import {
  RecordDeleteButton,
  RecordReadToggle,
} from "@/components/admin/inbox-record-actions"
import {
  CATEGORY_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCES,
  isCategory,
  isLeadSource,
  type LeadSource,
} from "@/lib/categories"
import { requireAdmin } from "@/lib/admin-auth"
import { cn } from "@/lib/utils"

export const metadata = {
  title: "Leads — Evergreen",
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

function categoryLabel(value: string): string {
  return isCategory(value) ? CATEGORY_LABELS[value] : value
}

function sourceLabel(value: string): string {
  return isLeadSource(value) ? LEAD_SOURCE_LABELS[value] : value
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>
}) {
  await requireAdmin()

  const { source: rawSource } = await searchParams
  const activeSource: LeadSource | undefined =
    rawSource && isLeadSource(rawSource) ? rawSource : undefined

  const [leads, counts] = await Promise.all([listLeads(activeSource), countLeadsBySource()])
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
  const unread = leads.filter((lead) => lead.readAt === null).length

  const tabs: { key: LeadSource | undefined; label: string; count: number }[] = [
    { key: undefined, label: "All", count: total },
    ...LEAD_SOURCES.map((key) => ({
      key,
      label: LEAD_SOURCE_LABELS[key],
      count: counts[key] ?? 0,
    })),
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to admin
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {leads.length === 0
            ? "No leads yet"
            : `${leads.length} ${leads.length === 1 ? "lead" : "leads"}, ${unread} to route`}
        </p>
      </div>

      <p className="mt-6 rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
        Every project request lands here: Find a Professional on the homepage,
        plus Get a Professional Quote on the Solar, Landscaping, Renovation and
        Agriculture pages. Nothing is forwarded by email — route each one to a
        matching company, then mark it handled.
      </p>

      <nav aria-label="Filter leads by source" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = tab.key === activeSource
            return (
              <li key={tab.key ?? "all"}>
                <Link
                  href={tab.key ? `/admin/leads?source=${tab.key}` : "/admin/leads"}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                    isActive
                      ? "border-primary bg-primary/15 font-medium text-foreground"
                      : "border-input bg-background text-muted-foreground hover:border-ring hover:text-foreground",
                  )}
                >
                  {tab.label}
                  <span className="tabular-nums text-xs text-muted-foreground">{tab.count}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {leads.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border px-4 py-12 text-center">
          <Inbox className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            {activeSource
              ? `No ${LEAD_SOURCE_LABELS[activeSource]} leads yet.`
              : "When someone submits a project, it shows up here."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {leads.map((lead) => {
            const isRead = lead.readAt !== null
            const details = [
              `ZIP ${lead.zip}`,
              lead.timeframe,
              lead.budget,
              lead.projectSize,
            ].filter(Boolean)
            return (
              <li
                key={lead.id}
                className={`rounded-xl border p-5 ${
                  isRead ? "border-border bg-card" : "border-primary/40 bg-card"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-lg font-semibold tracking-tight">
                        {categoryLabel(lead.category)}: {lead.service}
                      </h2>
                      {isRead ? null : (
                        <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{details.join(" · ")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{sourceLabel(lead.source)}</span>
                      {" · "}
                      {formatReceived(lead.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RecordReadToggle
                      id={lead.id}
                      read={isRead}
                      label={`lead from ${lead.name}`}
                      toggleAction={setLeadRead}
                    />
                    <RecordDeleteButton
                      id={lead.id}
                      label={`lead from ${lead.name}`}
                      deleteAction={deleteLead}
                    />
                  </div>
                </div>

                {lead.description ? (
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                    {lead.description}
                  </p>
                ) : null}

                {lead.notes ? (
                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Notes
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                      {lead.notes}
                    </p>
                  </div>
                ) : null}

                {lead.additionalProjects.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Also interested in
                    </p>
                    <ul className="mt-1 flex flex-col gap-1 text-sm text-foreground">
                      {lead.additionalProjects.map((project, i) => (
                        <li key={i}>
                          <span className="font-medium">{categoryLabel(project.category)}</span>
                          {project.service ? `: ${project.service}` : ""}
                          <span className="text-muted-foreground">
                            {[
                              project.zip && `ZIP ${project.zip}`,
                              project.timeframe,
                              project.projectSize,
                            ]
                              .filter(Boolean)
                              .map((part) => ` · ${part}`)
                              .join("")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-4 text-sm">
                  <span className="font-medium">{lead.name}</span>
                  <a href={`mailto:${lead.email}`} className="break-all text-primary">
                    {lead.email}
                  </a>
                  {lead.phone ? (
                    <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="text-primary">
                      {lead.phone}
                    </a>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

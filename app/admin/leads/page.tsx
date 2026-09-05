import Link from "next/link"
import { Inbox } from "lucide-react"
import { deleteLead, listLeads, setLeadRead } from "@/app/actions/leads"
import {
  RecordDeleteButton,
  RecordReadToggle,
} from "@/components/admin/inbox-record-actions"
import { CATEGORY_LABELS, isCategory } from "@/lib/categories"
import { requireAdmin } from "@/lib/admin-auth"

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

export default async function AdminLeadsPage() {
  await requireAdmin()

  const leads = await listLeads()
  const unread = leads.filter((lead) => lead.readAt === null).length

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
        Project requests from Find a Professional land here. They are not
        forwarded by email — route each one to a matching company, then mark it
        handled.
      </p>

      {leads.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border px-4 py-12 text-center">
          <Inbox className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            When someone submits a project, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {leads.map((lead) => {
            const isRead = lead.readAt !== null
            const category = isCategory(lead.category)
              ? CATEGORY_LABELS[lead.category]
              : lead.category
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
                        {category}: {lead.service}
                      </h2>
                      {isRead ? null : (
                        <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      ZIP {lead.zip} · {lead.timeframe}
                      {lead.budget ? ` · ${lead.budget}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
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

                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                  {lead.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-4 text-sm">
                  <span className="font-medium">{lead.name}</span>
                  <a href={`mailto:${lead.email}`} className="break-all text-primary">
                    {lead.email}
                  </a>
                  <a href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`} className="text-primary">
                    {lead.phone}
                  </a>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

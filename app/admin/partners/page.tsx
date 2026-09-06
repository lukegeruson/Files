import Link from "next/link"
import { Handshake } from "lucide-react"
import {
  deletePartnerApplication,
  listPartnerApplications,
  setPartnerApplicationRead,
} from "@/app/actions/partners"
import {
  RecordDeleteButton,
  RecordReadToggle,
} from "@/components/admin/inbox-record-actions"
import { partnershipLabel } from "@/lib/leads/constants"
import { CATEGORY_LABELS, isCategory } from "@/lib/categories"
import { requireAdmin } from "@/lib/admin-auth"

export const metadata = {
  title: "Partner applications — Evergreen",
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

function List({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> {items.join(", ")}
    </p>
  )
}

export default async function AdminPartnersPage() {
  await requireAdmin()

  const applications = await listPartnerApplications()
  const unread = applications.filter((application) => application.readAt === null).length

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
      <div>
        <Link
          href="/admin"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to admin
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
          Partner applications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {applications.length === 0
            ? "No applications yet"
            : `${applications.length} ${applications.length === 1 ? "application" : "applications"}, ${unread} unhandled`}
        </p>
      </div>

      <p className="mt-6 rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
        Applications from Partner with Evergreen land here and are not forwarded
        by email. Reply using the sender&apos;s work email below.
      </p>

      {applications.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border px-4 py-12 text-center">
          <Handshake className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            When a business applies to partner, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {applications.map((application) => {
            const isRead = application.readAt !== null
            const industry = isCategory(application.industry)
              ? CATEGORY_LABELS[application.industry]
              : application.industry
            return (
              <li
                key={application.id}
                className={`rounded-xl border p-5 ${
                  isRead ? "border-border bg-card" : "border-primary/40 bg-card"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-lg font-semibold tracking-tight">
                        {application.company}
                      </h2>
                      <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {partnershipLabel(application.interest)}
                      </span>
                      {isRead ? null : (
                        <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {industry} · {application.location}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatReceived(application.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <RecordReadToggle
                      id={application.id}
                      read={isRead}
                      label={`application from ${application.company}`}
                      toggleAction={setPartnerApplicationRead}
                    />
                    <RecordDeleteButton
                      id={application.id}
                      label={`application from ${application.company}`}
                      deleteAction={deletePartnerApplication}
                    />
                  </div>
                </div>

                {application.message ? (
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                    {application.message}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4">
                  <List label="Services" items={application.services} />
                  <List label="Service areas" items={application.serviceAreas} />
                  <List label="ZIPs" items={application.zips} />
                  <List label="Roles hiring for" items={application.jobs} />
                  <List label="Hiring locations" items={application.hiringLocations} />
                  {application.jobTitle ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Job title:</span>{" "}
                      {application.jobTitle}
                    </p>
                  ) : null}
                  {application.expertise ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Expertise:</span>{" "}
                      {application.expertise}
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span className="font-medium">{application.name}</span>
                  <a href={`mailto:${application.workEmail}`} className="break-all text-primary">
                    {application.workEmail}
                  </a>
                  {application.companyWebsite ? (
                    <a
                      href={application.companyWebsite}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="break-all text-primary"
                    >
                      {application.companyWebsite}
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

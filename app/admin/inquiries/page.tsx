import { listJobInquiries } from "@/app/actions/job-inquiry"
import { InquiryDeleteButton, InquiryReadToggle } from "@/components/inquiry-actions"
import { requireAdmin } from "@/lib/admin-auth"
import { Mail } from "lucide-react"
import Link from "next/link"

export const metadata = {
  title: "Openings inbox — Evergreen",
  robots: { index: false, follow: false },
}

/**
 * These are read as a to-do list, so an absolute date matters more than "2 days
 * ago" — you need to know how long someone has been waiting on a reply.
 */
function formatReceived(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value)
}

export default async function InquiriesPage() {
  await requireAdmin()

  const inquiries = await listJobInquiries()
  const unread = inquiries.filter((inquiry) => inquiry.readAt === null).length

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
          Openings inbox
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {inquiries.length === 0
            ? "No messages yet"
            : `${inquiries.length} ${inquiries.length === 1 ? "message" : "messages"}, ${unread} unhandled`}
        </p>
      </div>

      {/* Load-bearing, not a disclaimer: these messages are not emailed
          anywhere, so this page is the only place they exist. */}
      <p className="mt-6 rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
        Messages from the Companies page land here and are not forwarded by
        email. Reply using the sender&apos;s address below.
      </p>

      {inquiries.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border px-4 py-12 text-center">
          <Mail
            className="mx-auto size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            When someone submits the openings form, their message shows up here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {inquiries.map((inquiry) => {
            const isRead = inquiry.readAt !== null
            return (
              <li
                key={inquiry.id}
                className={`rounded-xl border p-5 ${
                  isRead ? "border-border bg-card" : "border-primary/40 bg-card"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-lg font-semibold tracking-tight">
                        {inquiry.subject}
                      </h2>
                      {isRead ? null : (
                        <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                          New
                        </span>
                      )}
                    </div>
                    {/* A real mailto: is right here — it opens your own client
                        to reply to a person, rather than being the app's
                        delivery mechanism. */}
                    <a
                      href={`mailto:${inquiry.fromEmail}?subject=${encodeURIComponent(`Re: ${inquiry.subject}`)}`}
                      className="mt-1 inline-block break-all text-sm font-medium text-primary"
                    >
                      {inquiry.fromEmail}
                    </a>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatReceived(inquiry.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <InquiryReadToggle
                      id={inquiry.id}
                      read={isRead}
                      subject={inquiry.subject}
                    />
                    <InquiryDeleteButton
                      id={inquiry.id}
                      subject={inquiry.subject}
                    />
                  </div>
                </div>

                {/* `whitespace-pre-wrap` keeps the sender's line breaks, and
                    `break-words` stops an unbroken paste from widening the row. */}
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                  {inquiry.message}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

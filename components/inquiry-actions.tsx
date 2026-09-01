"use client"

import { deleteInquiry, setInquiryRead } from "@/app/actions/job-inquiry"
import { Check, RotateCcw, Trash2 } from "lucide-react"
import { useTransition } from "react"

const BUTTON =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"

export function InquiryReadToggle({
  id,
  read,
  subject,
}: {
  id: string
  read: boolean
  subject: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void setInquiryRead(id, !read))}
      aria-label={
        read ? `Mark "${subject}" as unread` : `Mark "${subject}" as handled`
      }
      className={BUTTON}
    >
      {read ? (
        <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Check className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">
        {pending ? "Saving..." : read ? "Unread" : "Handled"}
      </span>
    </button>
  )
}

export function InquiryDeleteButton({
  id,
  subject,
}: {
  id: string
  subject: string
}) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    // This row is the only copy of the message — nothing was emailed — so the
    // confirm step matters more here than for content that can be rewritten.
    if (!confirm(`Delete "${subject}"? This cannot be undone.`)) return
    startTransition(() => void deleteInquiry(id))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={`Delete ${subject}`}
      className={`${BUTTON} hover:border-destructive hover:text-destructive`}
    >
      <Trash2 className="size-4 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">{pending ? "Deleting..." : "Delete"}</span>
    </button>
  )
}

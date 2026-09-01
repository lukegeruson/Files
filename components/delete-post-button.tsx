"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"
import { deletePostAction } from "@/app/actions"

export function DeletePostButton({
  id,
  title,
}: {
  id: string
  title: string
}) {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    startTransition(() => {
      deletePostAction(id)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={`Delete ${title}`}
      className="inline-flex size-9 items-center justify-center gap-1.5 rounded-md border border-border text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50 sm:size-auto sm:px-2.5 sm:py-1.5 sm:text-sm"
    >
      <Trash2 className="size-4 shrink-0" />
      <span className="hidden sm:inline">
        {pending ? "Deleting..." : "Delete"}
      </span>
    </button>
  )
}

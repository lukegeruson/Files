"use client"

import { useActionState, useEffect, useId, useRef, useState } from "react"
import { useFormStatus } from "react-dom"
import { Check, Loader2, Mail } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { sendJobInquiry, type InquiryState } from "@/app/actions/job-inquiry"

/**
 * "Email us about openings" opens a compose panel that submits straight to the
 * server, which records the message for the admin inbox. Nobody has to leave
 * the page or have a mail client configured — the previous `mailto:` handoff
 * silently dead-ended for anyone on webmail.
 */
export function EmailOpenings() {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState<InquiryState, FormData>(sendJobInquiry, {
    status: "idle",
  })

  const panelId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  // Move focus into the panel on open so the keyboard path matches the mouse one.
  useEffect(() => {
    if (open) emailRef.current?.focus()
  }, [open])

  // Dismiss on outside pointer press, returning focus to the trigger only for
  // Escape (an outside click has already moved the user's attention elsewhere).
  useEffect(() => {
    if (!open) return

    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const sent = state.status === "sent"

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Mail className="size-4" aria-hidden="true" />
        Email us about openings
      </button>

      {open ? (
        <div
          id={panelId}
          // Width has to leave room for the card padding this panel is nested
          // inside, not just the viewport edge, or it overflows on phones.
          className="absolute left-0 top-full z-20 mt-2 w-[min(24rem,calc(100vw-6rem))] rounded-xl border border-border bg-card p-4 shadow-lg"
        >
          {sent ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Check className="size-4 text-primary" aria-hidden="true" />
                Message received
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {state.message} We will reply to the address you gave us.
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Close
              </button>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-3">
              <p className="text-sm font-medium text-foreground">Email us about openings</p>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${panelId}-email`}
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Your email
                </label>
                <Input
                  id={`${panelId}-email`}
                  ref={emailRef}
                  name="fromEmail"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-10"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${panelId}-subject`}
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Subject
                </label>
                <Input
                  id={`${panelId}-subject`}
                  name="subject"
                  required
                  maxLength={200}
                  placeholder="Subject Message"
                  className="h-10"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${panelId}-message`}
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Message
                </label>
                <Textarea
                  id={`${panelId}-message`}
                  name="message"
                  required
                  maxLength={5000}
                  placeholder="Write a few sentences outlining your interests and previous experience"
                  rows={5}
                  className="min-h-28 resize-y leading-relaxed"
                />
              </div>

              {state.status === "error" && state.message ? (
                <p role="alert" className="text-sm leading-relaxed text-destructive">
                  {state.message}
                </p>
              ) : null}

              <SubmitButton />
            </form>
          )}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Split out because `useFormStatus` only reports the pending state of the form
 * it is rendered inside — reading it in the parent would always return false.
 */
function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Mail className="size-4" aria-hidden="true" />
      )}
      {pending ? "Sending…" : "Send message"}
    </button>
  )
}

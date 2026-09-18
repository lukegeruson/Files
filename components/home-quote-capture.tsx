"use client"

import { useState } from "react"
import { ArrowRight, Sparkles } from "lucide-react"
import { QuoteCapture, quoteSectionShell } from "@/components/quote-capture"
import {
  QUOTE_CATEGORIES,
  QUOTE_CATEGORY_ORDER,
  type QuoteCategory,
} from "@/lib/quote-capture"

/**
 * Homepage lead capture. Unlike the per-category pages, the visitor first picks
 * which kind of project they want a quote for; that choice then drives the same
 * multi-step QuoteCapture form, so the flow and success state stay identical
 * across the site.
 */
export function HomeQuoteCapture() {
  const [category, setCategory] = useState<QuoteCategory | null>(null)

  if (category) {
    return (
      <QuoteCapture
        category={category}
        defaultOpen
        onBack={() => setCategory(null)}
      />
    )
  }

  return (
    <section aria-label="Get a professional quote" className={quoteSectionShell}>
      <div className="space-y-5">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-2.5 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Free · No obligation
          </span>
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            Get a Professional Quote
          </h2>
          <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Tell us what you&apos;re working on and a vetted professional in your
            area can follow up. Start by choosing the type of project below.
          </p>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">
            What do you need a quote for?
          </legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {QUOTE_CATEGORY_ORDER.map((key) => {
              const cfg = QUOTE_CATEGORIES[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className="group flex flex-col items-start gap-2 rounded-2xl border border-input bg-background p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <span aria-hidden="true" className="text-2xl leading-none">
                    {cfg.emoji}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {cfg.label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Start
                    <ArrowRight
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>
    </section>
  )
}

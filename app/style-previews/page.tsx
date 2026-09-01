import type { Metadata } from "next"
import Image from "next/image"

export const metadata: Metadata = {
  title: "House style previews",
  description: "Concept references for the 3D solar house rendering styles.",
}

const STYLES: {
  slug: string
  name: string
  blurb: string
  recommended?: boolean
}[] = [
  {
    slug: "isometric",
    name: "Isometric diorama",
    blurb:
      "Floating base tile, crisp flat shapes, bold colors, all solar equipment visible. Beautiful and buildable.",
    recommended: true,
  },
  {
    slug: "holographic",
    name: "Holographic digital-twin",
    blurb:
      "Glowing translucent house with neon energy lines on a dark grid. Most striking, perfect for energy-flow visualization.",
  },
  {
    slug: "clay",
    name: "Miniature / claymation",
    blurb: "Soft rounded toy-like forms, warm and inviting. Friendliest look.",
  },
  {
    slug: "toon",
    name: "Toon / cel-shaded",
    blurb: "Bold outlines and banded cartoon lighting. Graphic and very readable.",
  },
  {
    slug: "blueprint",
    name: "Architectural blueprint",
    blurb: "White model with edge outlines and grid ground. Precise, technical tone.",
  },
  {
    slug: "photoreal",
    name: "Photoreal PBR",
    blurb:
      "The most lifelike, but the hardest to match in real time — shown for comparison.",
  },
]

export default function StylePreviewsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          3D concept references
        </p>
        <h1 className="text-pretty text-2xl font-semibold text-foreground">
          House rendering styles
        </h1>
        <p className="text-pretty leading-relaxed text-muted-foreground">
          Six directions for the solar house diagram. These are concept images —
          the live 3D version will be a faithful stylized take, not pixel-identical.
        </p>
      </header>

      <ul className="flex flex-col gap-8">
        {STYLES.map((style, i) => (
          <li key={style.slug} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="text-lg font-semibold text-foreground">
                {style.name}
              </h2>
              {style.recommended ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                  Recommended
                </span>
              ) : null}
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Image
                src={`/style-previews/${style.slug}.png`}
                alt={`${style.name} style preview of the solar house`}
                width={1024}
                height={1024}
                className="h-auto w-full"
                priority={i < 2}
              />
            </div>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              {style.blurb}
            </p>
          </li>
        ))}
      </ul>
    </main>
  )
}

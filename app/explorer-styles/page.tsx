import Image from "next/image"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Clay 3D Style Options",
  description:
    "Compare clay-3D visual directions for the farm, home upgrade, and landscape explorers.",
}

type Option = {
  id: string
  label: string
  blurb: string
  src: string
}

type Group = {
  key: string
  title: string
  description: string
  options: Option[]
}

const GROUPS: Group[] = [
  {
    key: "farm",
    title: "Farm Simulator",
    description:
      "Levitating clay farm in the solar-diorama style. Pick the base shape the crops and buildings sit on.",
    options: [
      {
        id: "A",
        label: "Floating farmland island",
        blurb:
          "Levitating chunk of farmland with crop rows, barn, silos and a craggy soil / roots underside. Most dramatic floating look.",
        src: "/farm-styles/option-a-island.png",
      },
      {
        id: "B",
        label: "Farm on a clay display board",
        blurb:
          "Tidy quilt of field patches, farmhouse, barn and pond on a clean beveled clay slab. Easiest to map fields to the crop-mix controls.",
        src: "/farm-styles/option-b-slab.png",
      },
      {
        id: "C",
        label: "Terraced hillside farm",
        blurb:
          "Stepped clay terraces at different heights with a trickling irrigation channel and layered rock strata. Most sculptural.",
        src: "/farm-styles/option-c-terraced.png",
      },
    ],
  },
  {
    key: "home",
    title: "Home Upgrade Explorer",
    description:
      "Clay house in the solar-diorama style. Pick how much of the house is revealed for the upgrade hotspots.",
    options: [
      {
        id: "A",
        label: "Dollhouse cutaway",
        blurb:
          "Front wall removed to reveal every room and system. Best for interior upgrade hotspots (kitchen, bath, HVAC, water heater).",
        src: "/renovation-styles/option-a-cutaway.png",
      },
      {
        id: "B",
        label: "Whole-house exterior",
        blurb:
          "Charming full exterior with solar roof, HVAC unit, garage and landscaping. Best for exterior / curb-appeal upgrades.",
        src: "/renovation-styles/option-b-exterior.png",
      },
      {
        id: "C",
        label: "Half cross-section",
        blurb:
          "One half finished exterior, the other sliced open showing insulation, pipes, panel and furnace. Balances inside + outside.",
        src: "/renovation-styles/option-c-halfcut.png",
      },
    ],
  },
  {
    key: "landscape",
    title: "Landscape Planner",
    description:
      "Clay yard in the solar-diorama style. Pick the base for the lawn-to-water-wise transformation.",
    options: [
      {
        id: "A",
        label: "Floating yard island",
        blurb:
          "Levitating yard split diagonally lawn ↔ xeriscape with a rocky underside. Best matches the transformation slider.",
        src: "/landscape-styles/option-a-island3d.png",
      },
      {
        id: "B",
        label: "Garden on a display board",
        blurb:
          "Designed yard with lawn, planting beds, patio and bistro set on a clean beveled slab. Neat and inviting.",
        src: "/landscape-styles/option-b-slab3d.png",
      },
      {
        id: "C",
        label: "Cozy cottage corner",
        blurb:
          "Plump, toy-like cottage-corner scene with big rounded trees and succulents. Most charming, least grid-like.",
        src: "/landscape-styles/option-c-corner3d.png",
      },
    ],
  },
]

export default function ExplorerStylesPage() {
  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-10 md:px-6">
        <header className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back home
          </Link>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Clay 3D style options
          </h1>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Three levitating clay-diorama directions for each explorer, in the
            same style as the solar page. Tell me which letter you want for the
            farm, home, and landscape and I&apos;ll rebuild each visual around it.
          </p>
        </header>

        {GROUPS.map((group) => (
          <section key={group.key} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {group.title}
              </h2>
              <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
                {group.description}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {group.options.map((opt) => (
                <figure
                  key={opt.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                >
                  <div className="relative aspect-square w-full bg-muted/40">
                    <Image
                      src={opt.src || "/placeholder.svg"}
                      alt={`${group.title} option ${opt.id}: ${opt.label}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-contain p-2"
                    />
                    <span className="absolute left-3 top-3 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow">
                      {opt.id}
                    </span>
                  </div>
                  <figcaption className="flex flex-col gap-1 border-t border-border p-4">
                    <span className="font-semibold text-foreground">
                      {opt.label}
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {opt.blurb}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

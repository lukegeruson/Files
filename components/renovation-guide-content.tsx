import { ChevronDown } from "lucide-react"

type Faq = { q: string; a: string[] }

/** Lead questions matching the highest-intent remodel cost searches. */
const LEAD_FAQS: Faq[] = [
  {
    q: "How much does a bathroom remodel cost?",
    a: [
      "Most bathroom remodels cost between $6,000 and $25,000, with the national midpoint near $12,000. A surface refresh — new vanity, toilet, fixtures, paint, and tile over existing layout — typically runs $4,000 to $9,000. A standard remodel that replaces everything but keeps the plumbing where it is lands around $10,000 to $20,000, and a full gut with a moved layout commonly reaches $25,000 to $45,000.",
      "The single biggest cost fork is whether the plumbing moves. Keeping the toilet, tub, and vanity in their existing locations avoids opening walls and floors to reroute supply and drain lines, which is why two bathrooms of identical size and finish quality can differ by $10,000. Select your scope in the calculator above to replace this national range with a figure built from your own room.",
    ],
  },
  {
    q: "How much does a kitchen remodel cost?",
    a: [
      "Kitchen remodels typically cost $15,000 to $60,000, with most homeowners landing between $25,000 and $40,000. A refresh that keeps the cabinet boxes and replaces doors, counters, and appliances runs $12,000 to $25,000. A standard full replacement is roughly $30,000 to $55,000, and a gut renovation with new layout, wiring, and structural changes routinely passes $75,000.",
      "Cabinetry is almost always the largest single line, commonly 30% to 40% of the total. That is where the stock-versus-semi-custom-versus-custom decision moves the budget more than any other choice you make — often by $15,000 or more on an average-sized kitchen. The calculator breaks your estimate down by line item so you can see exactly how much of the number is cabinets.",
    ],
  },
  {
    q: "How much does it cost to install a hot tub?",
    a: [
      "A hot tub installation costs $6,000 to $20,000 all in, and the tub itself is usually less than half of that. Entry-level plug-and-play models start near $4,000, mid-range 240V spas run $7,000 to $12,000, and swim spas reach $25,000 or more. The installation work — pad, electrical, and access — typically adds $3,000 to $8,000.",
      "The costs people miss are the pad and the circuit. A filled hot tub with occupants weighs 4,000 to 6,000 pounds, so it needs a reinforced concrete pad or an engineered deck, not pavers on soil. Most spas also require a dedicated 50-amp 240V GFCI circuit, which means a licensed electrician and usually a permit. Budget for both before you shop for tubs.",
    ],
  },
  {
    q: "What is the average cost per square foot to remodel?",
    a: [
      "Bathrooms run roughly $250 to $600 per square foot and kitchens $150 to $350 per square foot. Bathrooms cost more per square foot than almost any other room because the plumbing, waterproofing, ventilation, and tile work are concentrated into a very small footprint.",
      "Per-square-foot figures are useful as a sanity check but poor as a budget, because fixture count matters more than floor area. A 40 sq ft bathroom and a 90 sq ft bathroom both need one toilet, one shower, and one vanity, so the smaller room has a much higher per-square-foot number for identical work. The calculator reports your own per-square-foot figure alongside the itemized costs that produced it.",
    ],
  },
]

/** Line-item questions, one per major cost driver in the calculator. */
const COMPONENT_FAQS: Faq[] = [
  {
    q: "How much do kitchen cabinets cost?",
    a: [
      "Installed kitchen cabinets cost about $100 to $280 per linear foot for stock, $250 to $500 for semi-custom, and $500 to $1,200 for full custom. An average kitchen has 25 to 30 linear feet, so stock cabinets land near $4,000 to $8,000 while custom can exceed $30,000.",
      "Refacing is the option most people overlook. Replacing doors and drawer fronts while keeping sound cabinet boxes costs roughly a third of new cabinets and takes days instead of weeks. It only works if the existing boxes are solid and the layout already functions — refacing cannot fix a bad floor plan.",
    ],
  },
  {
    q: "How much do countertops cost installed?",
    a: [
      "Countertops cost about $40 to $70 per square foot for laminate and butcher block, $60 to $100 for granite, $70 to $120 for quartz, and $100 to $250 for natural stone slabs like marble. A typical 40 sq ft kitchen counter in quartz runs roughly $3,000 to $4,800 installed.",
      "Quartz has become the default for good reason: it costs about the same as granite, needs no sealing, and resists staining better. Marble is the one to think twice about in a kitchen — it etches from anything acidic, including lemon juice and wine, and that damage is permanent rather than cosmetic.",
    ],
  },
  {
    q: "How much does tile installation cost?",
    a: [
      "Tile installation costs $12 to $25 per square foot for ceramic and porcelain and $20 to $45 for natural stone, including materials and labor. Labor alone is usually $8 to $15 per square foot, and it is the line most affected by tile size and pattern.",
      "Small tiles, mosaics, and diagonal or herringbone layouts can add 30% to 50% to labor because of the extra cuts and setting time. Large-format tile is cheaper to install per square foot but demands a flatter substrate, which sometimes means paying for floor leveling first. In a shower, the waterproofing membrane underneath matters more than the tile on top.",
    ],
  },
  {
    q: "How much does it cost to move plumbing in a bathroom?",
    a: [
      "Relocating a bathroom fixture costs about $600 to $1,500 per fixture for supply lines, and moving a toilet drain runs $1,500 to $4,000 because it requires a new 3-inch drain line at the correct slope. On a concrete slab, breaking and repouring pushes a toilet relocation toward $3,000 to $5,000.",
      "This is the decision that most often separates a $12,000 bathroom from a $30,000 one. If the existing layout works, keeping the plumbing in place frees a large share of the budget for better tile, fixtures, and glass — where you will actually notice the money. Moving fixtures is worth it when the current layout genuinely does not function, not merely to shift a vanity a few feet.",
    ],
  },
  {
    q: "How much does an electrical panel upgrade cost?",
    a: [
      "Upgrading a panel to 200 amps costs $2,000 to $4,500, including the permit and utility coordination. Adding a single dedicated circuit — for a hot tub, range, or EV charger — runs $400 to $1,200 depending on the distance from the panel.",
      "Older homes with 100-amp service frequently need this before a kitchen remodel or hot tub, because modern appliance loads exceed what the panel can carry. It is unglamorous spending that adds nothing visible, but skipping a needed upgrade means nuisance breaker trips at best and a genuine fire risk at worst. Have an electrician check your service capacity before finalizing a remodel budget.",
    ],
  },
  {
    q: "Do I need a permit for a bathroom or kitchen remodel?",
    a: [
      "You generally need a permit whenever you move plumbing, alter electrical circuits, remove a wall, or change the structure. Cosmetic work — paint, flooring, swapping a vanity or countertop in place — usually does not. Permit fees typically run $150 to $2,000 depending on scope and jurisdiction.",
      "Unpermitted work causes real problems later. It surfaces during resale inspections, can void insurance claims on resulting damage, and sometimes has to be opened up and redone to be certified. The calculator flags which line items in your scope typically trigger a permit, but your local building department is the authority.",
    ],
  },
]

/** Repair-versus-replace and planning questions tied to the advisor tool. */
const PLANNING_FAQS: Faq[] = [
  {
    q: "Should I repair or replace it?",
    a: [
      "The practical rule is to replace when the repair costs more than about half of replacement, when the component is past roughly three-quarters of its expected service life, or when the same failure has recurred. Repair is the better call on a young component with a single isolated problem.",
      "Age matters more than most people expect, because a repair on a component near end of life buys months rather than years and you pay the labor twice. The Home Upgrade Advisor applies exactly this logic to what you tell it about each part of your house, weighing age against symptoms to sort the urgent from the merely worn.",
    ],
  },
  {
    q: "Which home upgrades should I do first?",
    a: [
      "Do anything that keeps water out and the house safe before anything cosmetic: roof, drainage and grading, plumbing leaks, and electrical hazards. Then move to comfort and efficiency such as HVAC, insulation, and windows, and only then to kitchens, baths, and finishes.",
      "The reason is straightforward — an active roof leak or a grading problem will damage the work you install on top of it. Remodeling a kitchen under a failing roof means paying for that kitchen twice. The advisor sorts your flagged items into urgency tiers so the sequence is explicit rather than guesswork.",
    ],
  },
  {
    q: "Which remodels have the best return on investment?",
    a: [
      "Minor kitchen remodels and midrange bathroom remodels typically recover 60% to 75% of their cost at resale, while upscale versions of the same projects recover noticeably less. Unglamorous work — roof, siding, garage door, HVAC — often returns better than luxury interior finishes.",
      "Two caveats matter. Recovery rates fall as spending rises, because buyers pay for a functional updated kitchen but rarely for a top-tier one. And a hot tub or pool is a lifestyle purchase, not an investment — it can even narrow your buyer pool. Renovate for how you will actually live in the house, and treat resale value as a secondary benefit.",
    ],
  },
  {
    q: "How accurate is a remodel cost calculator?",
    a: [
      "A good calculator lands within roughly 20% of real bids on straightforward work with measurable quantities, like tile, counters, and fixtures. Accuracy drops on anything that involves opening walls, since the cost depends on what is found inside them.",
      "Treat the output as a budget range rather than a quote. Its real value is the itemized breakdown: knowing cabinets are 35% of your kitchen number tells you where a change actually moves the total, and knowing the expected cost of each line lets you spot a contractor bid that is out of step with the market.",
    ],
  },
  {
    q: "How much contingency should I budget for a remodel?",
    a: [
      "Budget 10% to 15% on cosmetic work, 15% to 20% on standard remodels, and 20% to 25% on any gut renovation or older home. Remodels carry higher contingency than new construction because you cannot see behind finished walls until demolition starts.",
      "The common discoveries are hidden water damage, failed subfloor, out-of-code wiring, undersized drain lines, and in older homes asbestos or lead paint requiring licensed abatement. Projects without a contingency do not finish cheaper — they get cut mid-stream, usually by downgrading the finishes that were the point of the remodel.",
    ],
  },
  {
    q: "How can I reduce remodeling costs without cutting quality?",
    a: [
      "Keep the plumbing and walls where they are, reface rather than replace sound cabinets, choose quartz over natural stone, use large-format tile in simple layouts, and get three itemized bids since identical scope commonly varies 20% to 40% between contractors.",
      "Reduce scope before reducing quality. A smaller shower in good tile with proper waterproofing beats a large one built cheaply, because you use the room every day and hidden failures are expensive to fix. Phasing across two budget years also works well — do the structural and plumbing work first, then finishes later.",
    ],
  },
  {
    q: "Should I DIY a bathroom or kitchen remodel?",
    a: [
      "Painting, demolition, installing a vanity or toilet in an existing location, and simple flooring are realistic DIY projects that save meaningful labor. Tile setting is learnable but unforgiving in wet areas, where the waterproofing behind the tile is what prevents rot.",
      "Leave plumbing relocations, electrical circuits and panel work, structural changes, and gas lines to licensed trades. These are permit-regulated for good reason, and mistakes cause water damage, fire risk, or failed inspections that must be torn out. The calculator lets you compare a general contractor, direct trade hiring, and DIY-assisted labor so you can see what each approach actually saves.",
    ],
  },
]

const ALL_FAQS = [...LEAD_FAQS, ...COMPONENT_FAQS, ...PLANNING_FAQS]

function FaqItem({ faq }: { faq: Faq }) {
  return (
    <details className="group border-b border-border [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left transition-colors hover:text-primary">
        <h3 className="text-balance font-serif text-lg font-semibold leading-snug">{faq.q}</h3>
        <ChevronDown
          className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:-rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="flex flex-col gap-3 pb-5 pr-9">
        {faq.a.map((para) => (
          <p key={para.slice(0, 40)} className="text-pretty leading-relaxed text-muted-foreground">
            {para}
          </p>
        ))}
      </div>
    </details>
  )
}

export function RenovationGuideContent() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: ALL_FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a.join(" ") },
    })),
  }

  return (
    <div className="flex flex-col gap-6">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="flex flex-col gap-3">
        <h2 className="text-balance font-serif text-3xl font-semibold tracking-tight">
          Remodeling Costs FAQ
        </h2>
      </div>

      <div id="renovation-faq" className="max-w-3xl border-t border-border">
        {ALL_FAQS.map((faq) => (
          <FaqItem key={faq.q} faq={faq} />
        ))}
      </div>
    </div>
  )
}

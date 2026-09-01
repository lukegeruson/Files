import { ChevronDown } from "lucide-react"

type Faq = { q: string; a: string[] }

/** Lead questions matching the highest-intent cost searches. */
const LEAD_FAQS: Faq[] = [
  {
    q: "How much does landscaping cost?",
    a: [
      "Most homeowners spend between $4,000 and $20,000 on a landscaping project, with the national midpoint landing near $8,000. Simple work — new sod, fresh mulch, a few shrubs — often comes in under $5,000. Once you add hardscape, irrigation, or grading, projects routinely pass $25,000, and a full property redesign with a patio, retaining wall, and mature plantings can reach $60,000 or more.",
      "The spread is enormous because 'landscaping' covers everything from spreading mulch to building structures. What actually drives your number is which components you include, how much square footage each one covers, and whether the work is installed by a crew or done yourself. Select your components in the calculator above to replace that national range with a figure built from your own yard.",
    ],
  },
  {
    q: "What is the average landscaping cost per square foot?",
    a: [
      "Landscaping runs roughly $4 to $12 per square foot for softscape work like lawn, beds, and planting, and $15 to $40 per square foot for hardscape like patios, walkways, and walls. Averaged across a whole yard, a modest project lands near $5 to $10 per square foot and a high-end one near $20 to $30.",
      "Per-square-foot pricing is useful for a sanity check but misleading as a budget, because the number depends entirely on the mix. A 1,000 sq ft yard that is all patio costs several times a 1,000 sq ft yard that is all lawn. The calculator shows your own price per square foot alongside the itemized costs that produced it.",
    ],
  },
  {
    q: "How much does backyard landscaping cost?",
    a: [
      "Backyard projects typically run $5,000 to $30,000 because backyards are where the expensive features go: patios, fire pits, retaining walls, fencing, and irrigation. A basic backyard cleanup with new lawn and beds might be $4,000, while a patio with seating walls, lighting, and planting commonly runs $20,000 to $40,000.",
      "Backyards also cost more per square foot than front yards for a practical reason: access. If a crew cannot get a skid steer through a gate, material has to be wheelbarrowed in and debris carried out by hand, which can add 20% or more to labor on hardscape and grading work.",
    ],
  },
  {
    q: "How much does front yard landscaping cost?",
    a: [
      "Front yard landscaping usually costs $2,500 to $12,000. Front yards are smaller, mostly softscape, and driven by curb appeal — lawn, foundation beds, a walkway, and a few trees. That combination is one of the better returns in home improvement, with well-executed front yard work commonly recovering a large share of its cost at resale.",
      "The most cost-effective front yard package is new sod or seed, cleanly edged mulch beds, and a modest number of well-placed shrubs. Adding a paver walkway or landscape lighting raises the price meaningfully but also does the most for how the house reads from the street.",
    ],
  },
]

/** Component-level cost questions, one per major line item in the calculator. */
const COMPONENT_FAQS: Faq[] = [
  {
    q: "How much does sod cost installed?",
    a: [
      "Sod costs about $0.35 to $0.60 per square foot for the turf itself and $1.00 to $2.00 per square foot installed, including ground prep. A 500 sq ft pallet covers a small front yard and runs $175 to $300 delivered. Sodding 2,000 sq ft professionally typically costs $2,000 to $4,000.",
      "Seeding the same area costs a fraction — roughly $0.15 to $0.30 per square foot installed — but takes a full growing season to establish and needs consistent watering to succeed. Sod buys you an instant lawn and much better odds on a slope; seed buys you savings and a wider choice of grass varieties.",
    ],
  },
  {
    q: "How much mulch, soil, or gravel do I need?",
    a: [
      "Bulk material is sold by the cubic yard, and one cubic yard covers about 108 square feet at 3 inches deep. The formula is square footage times depth in inches, divided by 324. So a 600 sq ft bed at 3 inches needs about 5.5 cubic yards. One cubic yard equals roughly 13.5 of the 2-cubic-foot bags sold at garden centers.",
      "Delivered bulk mulch runs $35 to $60 per cubic yard, topsoil $30 to $55, and gravel $45 to $75, plus a delivery fee of around $75 to $125 per load. Buying bulk beats bags on anything over about two cubic yards. The calculator works out these quantities for you and rolls the delivery cost into the estimate.",
    ],
  },
  {
    q: "How much does a patio cost?",
    a: [
      "A patio costs $10 to $20 per square foot for poured concrete, $20 to $30 for pavers, and $30 to $45 for natural flagstone, installed. A typical 300 sq ft paver patio therefore runs about $6,000 to $9,000. Stamped concrete sits between plain concrete and pavers at roughly $15 to $22 per square foot.",
      "Most of the money is in what you cannot see. A proper patio needs 4 to 8 inches of compacted gravel base, and skimping there is the single most common cause of settling and heaving within a few years. Pavers cost more upfront than concrete but can be lifted and reset individually, whereas a cracked concrete slab is a replacement.",
    ],
  },
  {
    q: "How much does a retaining wall cost?",
    a: [
      "Retaining walls are priced by the square foot of wall face — length times height — at roughly $45 to $70 for segmental block, $70 to $100 for natural stone, and $30 to $50 for timber. A 30-foot wall 3 feet tall is 90 square feet of face, so about $4,000 to $6,500 in block.",
      "Height changes everything. Walls over 3 to 4 feet usually require an engineered design, a permit, and geogrid reinforcement, which can double the per-square-foot cost. Terracing a slope with two short walls is often cheaper than one tall wall for exactly that reason, and it gives you usable planting space between them.",
    ],
  },
  {
    q: "How much does an irrigation system cost?",
    a: [
      "A sprinkler system costs about $0.60 to $1.20 per square foot installed, or roughly $2,500 to $5,000 for a typical quarter-acre lot. Cost is driven by zones: each zone covers about 2,000 square feet and needs its own valve and controller station, so systems are priced per zone at roughly $700 to $1,200 each.",
      "Irrigation is one of the few components worth leaving to a contractor even if you are handy. Tying into the water main requires backflow prevention, which is code-regulated and often permitted, and a mis-designed zone layout produces dry spots you will fight for years. Adding a smart controller costs $150 to $350 and typically cuts water use by 20% to 30%.",
    ],
  },
  {
    q: "How much do trees and shrubs cost planted?",
    a: [
      "Planted shrubs run about $40 for a 1-gallon plant, $80 for a 3-gallon, and $140 for a 5-gallon. Trees range from roughly $235 for a small 5-to-8-foot specimen to $1,200 or more for mature stock over 12 feet, including planting and staking.",
      "Buying smaller is almost always the better value. Small trees cost a fraction of mature ones, suffer far less transplant shock, and often catch up to a larger planting within five to seven years. Spend the savings on soil preparation instead — it does more for long-term plant health than starting size does.",
    ],
  },
  {
    q: "How much does grading and drainage cost?",
    a: [
      "Yard grading runs about $1.50 to $2.50 per square foot, or $1,500 to $5,000 for a typical yard, and includes machine time plus hauling fill in or out. A French drain costs roughly $40 to $65 per linear foot installed, so a 60-foot run is about $2,500 to $4,000.",
      "Both belong at the front of a project, not the end. Water and slope problems will damage whatever you build on top of them, so grading and drainage come before patios, walls, and planting. It is also the category with the widest bid spread, because what a crew finds when they dig — rock, clay, buried utilities — is genuinely unknown until they start.",
    ],
  },
  {
    q: "How much does a fence cost per foot?",
    a: [
      "Installed fencing costs about $18 per linear foot for chain link, $32 for wood privacy, $42 for vinyl, $48 for aluminum, and $56 for composite. A 150-foot wood privacy fence therefore runs roughly $4,000 to $5,500, plus more if the ground slopes or old fencing has to come out first.",
      "Height raises material cost more than labor, since a 6-foot and an 8-foot fence use the same number of posts and post holes — the most labor-intensive part. Before pricing anything, check your survey and local code: setback rules, height limits, and HOA restrictions frequently dictate what you can actually build.",
    ],
  },
]

/** Practical planning and budgeting questions. */
const PLANNING_FAQS: Faq[] = [
  {
    q: "How accurate is a landscape estimate calculator?",
    a: [
      "A good calculator gets you within about 20% of real bids for straightforward work like sod, mulch, and planting, because those are driven by measurable quantities and well-known unit rates. Accuracy drops on anything involving excavation, since the cost depends on what is underground.",
      "Treat the output as a budget range, not a quote. Its real value is the itemized breakdown: knowing that your patio is 40% of the project tells you where to negotiate, and knowing the expected cost of each line lets you spot a contractor bid that is wildly out of step.",
    ],
  },
  {
    q: "What percentage of landscaping cost is labor?",
    a: [
      "Labor is typically 40% to 60% of a professionally installed landscaping project. It skews higher on labor-intensive work like planting, spreading mulch, and building walls, and lower on material-heavy items like a fence or bulk gravel where the product itself carries the cost.",
      "That ratio is why DIY savings are so large on some components and so small on others. Doing your own mulch and planting can cut those lines by half, while doing your own fence saves less because you are still buying the same materials and renting the auger.",
    ],
  },
  {
    q: "Should I DIY landscaping or hire a professional?",
    a: [
      "Mulching, seeding, planting shrubs and perennials, and simple gravel work are genuinely DIY-friendly and where you save the most relative to effort. Sod is manageable but heavy and perishable — it has to go down within a day or two of delivery.",
      "Leave retaining walls, grading, irrigation tie-ins, and driveway-grade paving to professionals. These involve structural loads, permits, code-regulated plumbing, or slope work where a mistake redirects water toward your foundation. The calculator flags which components fall into each category as you select them.",
    ],
  },
  {
    q: "How much should I budget for contingency?",
    a: [
      "Add 10% to 15% for most landscaping projects, and 15% to 20% if the work involves excavation, grading, drainage, or a retaining wall. Contingency covers what nobody could see when the estimate was written: rock, tree roots, unmarked utilities, poor soil, and weather delays.",
      "Projects that skip a contingency do not come in cheaper — they come in over budget and get cut mid-stream, usually by dropping the planting that was going to make the hardscape look finished. Build the buffer in from the start and treat it as part of the real number.",
    ],
  },
  {
    q: "How can I reduce landscaping costs without cutting quality?",
    a: [
      "Phase the project across two seasons, doing structural work first and planting later; get three itemized bids, since identical scope commonly varies 20% to 40% between contractors; buy smaller plants and let them grow in; and self-perform the mulch and planting while hiring out the hardscape.",
      "Also reconsider size before quality. A smaller patio in good pavers beats a large one in the cheapest material available, because you will notice a failing surface every day and the extra square footage almost never gets used. Reducing scope preserves the result in a way that downgrading materials does not.",
    ],
  },
  {
    q: "When is the cheapest time of year to landscape?",
    a: [
      "Late fall and winter are the cheapest windows in most climates. Demand falls after the spring rush, crews have open schedules, and many contractors will discount to keep their teams working. Fall is also the best planting season in much of the country — cool air and warm soil establish roots with far less watering.",
      "Spring is the most expensive time to book, since everyone decides to fix their yard at once. If your project involves hardscape rather than plants, winter work is often perfectly feasible in mild regions and can save 10% to 15% on labor.",
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

export function LandscapingGuideContent() {
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
          Landscaping Costs FAQ
        </h2>
      </div>

      <div id="landscaping-faq" className="max-w-3xl border-t border-border">
        {ALL_FAQS.map((faq) => (
          <FaqItem key={faq.q} faq={faq} />
        ))}
      </div>
    </div>
  )
}

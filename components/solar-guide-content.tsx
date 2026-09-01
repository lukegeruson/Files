import { ChevronDown } from "lucide-react"

type Faq = { q: string; a: string[] }

/**
 * The six explanatory topics that used to render as long-form paragraph
 * sections, rewritten as question-led FAQ entries.
 */
const TOPIC_FAQS: Faq[] = [
  {
    q: "How much does home solar cost?",
    a: [
      "Residential solar is priced per watt of capacity, generally around $2.50 to $3.50 per watt installed before incentives. That puts a typical 8 kW system near $20,000 to $28,000 gross, or roughly $14,000 to $20,000 after the 30% federal credit. The price covers panels, inverters, racking, wiring, permits, labor, and the installer's margin, which is why quotes for identical hardware can differ by thousands.",
      "Small systems cost more per watt because permitting and truck rolls are fixed costs spread over fewer panels. Tile and flat roofs raise labor, and a main panel upgrade or trenching for a ground mount adds more. If your roof is within a few years of replacement, budget for re-roofing first, since removing and resetting an array later is pure added cost.",
    ],
  },
  {
    q: "How do solar savings actually accrue?",
    a: [
      "Solar does not pay you; it stops you from paying the utility. Every kilowatt-hour your roof makes and your home uses is one you do not buy, so savings equal production times your rate. That makes your electricity price the single most important variable: the same array saves roughly three times as much in a 30-cent state as in a 10-cent one.",
      "Savings also grow. Utility rates have historically climbed a few percent a year while your system's cost is fixed on day one, so the gap widens annually even as panels lose about half a percent of output per year. What your surplus is worth depends on net metering: full-retail credit makes the grid a free battery, while lower export rates reward using power as you make it.",
    ],
  },
  {
    q: "What is a solar payback period?",
    a: [
      "Payback is the point where cumulative savings equal your net cost. Divide net cost by first-year savings for a rough figure, then shorten it slightly to account for rising rates. Most homeowners land between 7 and 12 years, which leaves well over a decade of essentially free electricity, since quality panels carry 25-year production warranties.",
      "Payback matters most if you might move. If your horizon is shorter than your payback, you are relying on resale value rather than bill savings to come out ahead, which is a weaker and less certain proposition. Heavy shade, a north-facing roof, or unusually cheap power can push payback past the point where the investment makes sense.",
    ],
  },
  {
    q: "What return on investment does solar deliver?",
    a: [
      "Over 25 years a well-sited system commonly returns two to three times its net cost, which compares favorably with conservative investments and is effectively tax-free because you are avoiding an expense rather than earning income. Expressed as an annual return, good installations often land in the high single digits to low teens.",
      "Financing changes the picture. Interest can consume a meaningful share of lifetime savings, so compare the loan payment against your current bill: if the payment is lower, you are cash-flow positive from month one even though total return is reduced. Leases and PPAs trade most of the upside for zero upfront cost and no maintenance duties.",
    ],
  },
  {
    q: "Which solar incentives and tax credits apply?",
    a: [
      "The federal residential clean energy credit is worth 30% of your total system cost, batteries included, and it applies only if you own the system. It is nonrefundable, so it offsets tax you owe rather than arriving as a check, though unused credit can generally carry forward. Confirm your own tax situation before counting on the full amount.",
      "Beyond the federal credit, incentives vary sharply by location: state rebates, utility performance payments, renewable energy credits, and property or sales tax exemptions all exist in some markets. Because these stack differently everywhere, treat the calculator's incentive line as a placeholder and verify local programs.",
    ],
  },
  {
    q: "Do I need a battery for backup power?",
    a: [
      "A home battery stores daytime production for evening use or outages, typically adding $10,000 to $16,000 before the tax credit. Purely financially it is a hard sell under full-retail net metering, because the grid already credits your exports at the same price you would otherwise save by storing them.",
      "Storage earns its keep in two situations. Where utilities use time-of-use pricing or pay little for exports, shifting power into expensive hours recovers real value. And where outages are common, a battery is the only way solar keeps your home running, because a grid-tied array without storage shuts down for line-worker safety the moment the grid goes down.",
    ],
  },
]

/** Panel-count and system-sizing questions that pair with the panel calculator. */
const PANEL_FAQS: Faq[] = [
  {
    q: "How many solar panels does it take to power a house?",
    a: [
      "Most US homes need somewhere between 15 and 25 panels. A typical household uses about 10,800 kWh a year, and in average sun a single kilowatt of panels produces roughly 1,300 to 1,600 kWh annually, so covering that usage takes about 7 to 8 kW. At today's common 400-watt modules that works out to 18 to 20 panels.",
      "The range is wide because two variables move it more than anything else: how much electricity you use, and how much sun your specific roof gets. An efficient home in Arizona might need 12 panels, while an all-electric home with two EVs in cloudy New England could need 40. Enter your own bill and ZIP in the calculator above for a figure based on your situation.",
    ],
  },
  {
    q: "How many solar panels do I need for 1,000 kWh per month?",
    a: [
      "Using 1,000 kWh a month means 12,000 kWh a year. In average US sun that calls for roughly an 8 to 9 kW system, which is about 20 to 23 panels at 400 watts each. In very sunny states you might need only 17 or 18; in the cloudiest parts of the country, closer to 27.",
      "The math is straightforward: divide your annual usage by the yearly output of one kilowatt of panels where you live, then divide that system size by your panel wattage and round up. The calculator above does this for you and shows each step.",
    ],
  },
  {
    q: "What size solar system do I need?",
    a: [
      "System size is measured in kilowatts of panel capacity, and most homes land between 6 and 12 kW. To size yours, divide your annual kWh usage by the annual production per kW in your area, typically 1,200 kWh per kW in cloudy northern states and up to 1,800 in the desert southwest.",
      "Size up if you are about to add load, since it is far cheaper to add panels during the original install than to return later for a second permit and truck roll. An EV adds roughly 3,000 kWh a year, and replacing gas heat with a heat pump can add several thousand more. Size down if your utility pays little for exported power, in which case a system matched to your daytime usage often returns more than a larger one.",
    ],
  },
  {
    q: "How much roof space do solar panels need?",
    a: [
      "Budget roughly 20 square feet per panel once you account for spacing and code setbacks. A 400-watt panel is about 21 square feet on its own, so a 20-panel array needs somewhere near 500 square feet of usable, unobstructed roof, not 420.",
      "Usable area is the key phrase. Fire code requires clear pathways and ridge setbacks, and vents, chimneys, skylights and dormers all break up an otherwise good roof face. A 1,500-square-foot roof rarely offers 1,500 square feet for panels, which is why higher-wattage modules matter when space is tight: fewer, denser panels deliver the same output in less area.",
    ],
  },
  {
    q: "How many watts of solar do I need?",
    a: [
      "Divide your yearly kWh usage by the annual production of one watt where you live, or work in kilowatts and multiply by 1,000. A home using 12,000 kWh a year in average sun needs about 8,000 to 9,000 watts of panels. That total is what determines your panel count once you pick a module size.",
      "Panel wattage itself does not change how much energy you need, only how many panels it takes to get there. The same 8 kW system is 23 panels at 350 W or 16 panels at 500 W, producing the same electricity while occupying meaningfully different amounts of roof.",
    ],
  },
]

/** The two headline questions, shown first. */
const LEAD_FAQS: Faq[] = [
  {
    q: "Is solar worth it?",
    a: [
      "For most homeowners with an unshaded, reasonably oriented roof and average or above-average electricity rates, solar pays for itself well within the panels' 25-year life and then produces nearly free power. It is usually not worth it if your roof is heavily shaded, faces mostly north, your electricity is unusually cheap, or you plan to move before the payback period ends.",
    ],
  },
  {
    q: "How much can solar save?",
    a: [
      "Savings equal the electricity you no longer buy. A system offsetting most of a typical bill commonly saves somewhere between $1,000 and $2,500 in its first year, and considerably more over time as utility rates rise. Because savings scale with your rate and your usage, the same array saves far more in a high-rate state than a low-rate one.",
    ],
  },
]

/** Shorter, quick-answer questions. */
const QUICK_FAQS: Faq[] = [
  {
    q: "How long does solar take to pay for itself?",
    a: [
      "Typical payback runs about 7 to 12 years after incentives. Faster paybacks come from high electricity rates, strong sun, a south-facing roof, and a competitively priced install. Longer paybacks come from shade, cheap power, or premium pricing. Use the calculator above to see the payback for your own numbers.",
    ],
  },
  {
    q: "Should I pay cash or finance solar?",
    a: [
      "Paying cash produces the highest lifetime return because you avoid interest entirely, and you claim the federal tax credit yourself. Financing gets you solar with no money down and often a monthly loan payment lower than your old bill, but interest reduces total savings. A lease or PPA has no upfront cost and no maintenance responsibility, but the installer keeps the tax credit and your savings are the smallest of the three.",
    ],
  },
  {
    q: "Is solar with a battery better than solar without one?",
    a: [
      "A battery rarely pays for itself on bill savings alone. It makes sense when your utility uses time-of-use rates or has cut net metering, so exported power is worth less than power you consume, or when you want backup during outages, since a grid-tied system without storage shuts off in a blackout. If you have full-retail net metering and reliable power, panels alone usually give the better return.",
    ],
  },
  {
    q: "Does solar increase home value?",
    a: [
      "Owned systems generally add measurable resale value, and buyers increasingly view paid-off panels as an upgrade that lowers operating costs. Leased systems are different: the contract must be transferred to the buyer, which can complicate a sale. If you may move before payback, ownership is the safer structure.",
    ],
  },
]

const ALL_FAQS = [...LEAD_FAQS, ...TOPIC_FAQS, ...PANEL_FAQS, ...QUICK_FAQS]

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

export function SolarGuideContent() {
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
          Understanding Solar FAQ
        </h2>
      </div>

      <div id="solar-faq" className="max-w-3xl border-t border-border">
        {ALL_FAQS.map((faq) => (
          <FaqItem key={faq.q} faq={faq} />
        ))}
      </div>
    </div>
  )
}

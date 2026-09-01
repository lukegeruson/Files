import { ChevronDown } from "lucide-react"

type Faq = { q: string; a: string[] }

/** Lead questions matching the highest-intent crop selection searches. */
const LEAD_FAQS: Faq[] = [
  {
    q: "What is the most profitable crop per acre?",
    a: [
      "Per acre, high-value specialty crops lead by a wide margin. On a blended wholesale and direct-market price, garlic returns roughly $10,500 an acre over inputs and labor, staked fresh-market tomatoes about $14,000, and salad greens near $8,900. Commodity row crops are an entirely different order of magnitude: corn, soybeans, and wheat return somewhere between $130 and $290 an acre on that same basis.",
      "Two cautions make those numbers less exciting than they look. First, per-acre profit is the wrong figure to optimize alone — tomatoes beat corn by a factor of fifty an acre, but almost nobody can plant, weed, harvest, pack, and sell forty acres of them. Specialty crops are capped by labor and by how much you can genuinely sell; commodity crops are capped by land. Second, those figures are gross margins that do not yet carry land rent or machinery. Add those and commodity crops frequently turn negative — corn at recent prices loses about $200 an acre against corn-belt cash rent. The crop selection tool ranks the gross margin; the profitability calculator carries it through to a true net.",
    ],
  },
  {
    q: "How do I decide what to plant on my land?",
    a: [
      "Work through the hard constraints before you look at prices. Your frost-free days determine which crops can finish at all. Your soil texture and drainage rule out whole categories — root crops fail in heavy clay, and most vegetables drown in poorly drained ground. Your available water, whether from rainfall or irrigation, sets a ceiling that no amount of management overcomes. Only after those gates do equipment, labor, capital, storage, and market access come into play.",
      "This order matters because a crop that fails a hard constraint cannot be rescued by a good price. A farmer drawn to a $12,000-an-acre crop that needs 34 inches of water on land receiving 18 inches of rain with no irrigation is not looking at an opportunity; they are looking at a crop failure with extra steps. The tool above applies these gates in sequence and tells you explicitly which crops were ruled out and why, which is usually more useful than the recommendation itself.",
    ],
  },
  {
    q: "What crops grow best in a short growing season?",
    a: [
      "With 90 to 120 frost-free days, your reliable options are small grains and cool-season crops: spring barley and oats finish in 90 to 100 days, canola in about 95, and hardy vegetables such as lettuce, spinach, radishes, and peas mature in 45 to 70 days. Fall-planted winter wheat sidesteps the problem entirely by overwintering and using spring moisture before summer heat arrives.",
      "Short seasons also reward transplants and protected culture. Starting tomatoes, peppers, and brassicas indoors buys four to six weeks, and low tunnels or row cover add another two to three weeks at each end. That is often the difference between a crop that ripens and one caught by an early frost. Enter your actual frost-free days in the tool above rather than a regional average, because elevation and proximity to water can shift a local season by three weeks or more.",
    ],
  },
  {
    q: "What is the best crop to grow on 5 acres?",
    a: [
      "Five acres is too small to justify row-crop equipment and too small for commodity margins to add up to a living, so the answer is almost always a high-value crop sold directly. Garlic, salad greens, tomatoes, winter squash, cut flowers, and berries all work at this scale, and five acres of intensive vegetables can gross $50,000 to $150,000 with strong direct-market channels.",
      "At this scale your binding constraints are labor and sales, not land. Five acres of hand-harvested vegetables can demand well over 1,000 field hours, and every pound has to find a buyer at retail or near-retail prices for the economics to work. Farmers who succeed on small acreage usually secure the market first — a farmers market stall, a CSA list, restaurant accounts — and then plant to match. Growing it and hoping to sell it is how small farms fail.",
    ],
  },
]

/** Questions covering each major constraint the tool scores against. */
const CONSTRAINT_FAQS: Faq[] = [
  {
    q: "How much water do crops need per acre?",
    a: [
      "Seasonal water needs range widely: small grains such as oats and barley finish on 12 to 16 inches, soybeans and sunflowers want 18 to 24, corn needs 22 to 30, and thirsty vegetables and alfalfa can require 30 to 40 inches or more. An inch of water across one acre is roughly 27,000 gallons, so the difference between a 15-inch crop and a 35-inch crop is over half a million gallons per acre.",
      "What matters is not annual rainfall but how much water is available during the growing season, plus what your soil can hold in reserve. Roughly 65% of annual precipitation typically falls in the growing season, and a deep silt loam stores four to five inches of plant-available water while sand holds barely one. That reserve is why the same 18 inches of rain produces a crop on good ground and a failure on sand. The tool above accounts for rainfall, soil storage, and irrigation together.",
    ],
  },
  {
    q: "Which crops grow best in clay, sandy, or loam soil?",
    a: [
      "Loam and silt loam are the most forgiving and suit nearly everything. Heavy clay holds water and nutrients well and grows excellent small grains, soybeans, and hay, but it compacts easily, warms slowly in spring, and is poor for root crops — carrots and potatoes come out misshapen and hard to harvest. Sandy soils drain fast and warm early, which makes them ideal for sweet potatoes, peanuts, melons, and early vegetables, but they need frequent irrigation and lose nitrogen readily.",
      "Drainage often matters more than texture. Most crops need moderately to well-drained ground, and poorly drained fields drown roots and invite disease regardless of how fertile the soil is. If a field ponds after rain, that is the first thing to fix — through tile drainage or by choosing water-tolerant crops such as grass hay or rice — before optimizing anything else.",
    ],
  },
  {
    q: "How many labor hours per acre does farming take?",
    a: [
      "Mechanized row crops need very little field labor: corn, soybeans, and wheat run 2 to 3 hours per acre for the whole season. Hay is 5 to 7 hours per cutting. Vegetables are a different world — winter squash and pumpkins take 70 to 85 hours per acre, potatoes around 45, and hand-harvested crops such as garlic, tomatoes, salad greens, and berries demand 240 to 450 hours per acre once planting, weeding, harvest, washing, and packing are counted.",
      "Labor is the constraint that most often decides what a farm can realistically grow. One person working full time through a season covers roughly 1,200 field hours, a working family perhaps 2,600, and a small hired crew around 9,000. At 320 hours per acre, garlic pencils out beautifully on two acres and becomes impossible at thirty. Any crop budget that omits the value of your own time will overstate profit substantially, which is why the tool above costs all labor at an hourly rate.",
    ],
  },
  {
    q: "How much does it cost to plant an acre of crops?",
    a: [
      "Operating costs per acre, excluding land and machinery ownership, run about $265 to $400 for small grains, $490 to $830 for corn, soybeans, and cotton, and $215 to $440 for hay. Vegetables climb steeply: $1,800 for pumpkins, $2,200 for winter squash, $3,600 for potatoes and sweet potatoes, and $6,200 to $9,800 for lettuce, garlic, and fresh-market tomatoes once seed, plastic, containers, cooling, and packing are included.",
      "Judge these against your total operating capital, not per acre. Six thousand dollars an acre is an ordinary market-garden budget on five acres and an impossible one on four hundred. Perennials add a further wrinkle: blueberries and apples cost $8,000 to $20,000 an acre to establish and yield nothing for three to five years, so they demand capital that can sit idle. The tool above checks the total cash a crop plan requires against the capital you actually have.",
    ],
  },
  {
    q: "Do I need special equipment to grow a crop?",
    a: [
      "Equipment is a genuine gate, not a preference. Small grains and row crops need a tractor with tillage, a grain drill or planter, and access to a combine — and combines for specialty crops such as dry edible beans or sunflowers often need specific headers or attachments. Vegetables can be grown with a compact tractor, a rotary tiller, and hand tools at small scale, but past a few acres a transplanter, plastic mulch layer, and mechanical harvest aid become necessary.",
      "Custom hiring is the usual way around a missing machine, and it is often smarter than buying. Custom combining runs roughly $40 to $60 an acre and custom baling $20 to $35 — real money, but far less than the payments and depreciation on equipment used two weeks a year. The tool above adds an estimated custom-hire cost when the crop needs machinery beyond what you have, rather than pretending the gap does not exist.",
    ],
  },
  {
    q: "Which crops improve soil health?",
    a: [
      "Legumes fix their own nitrogen and leave some behind: soybeans, dry edible beans, peanuts, and especially alfalfa, which can contribute 100 to 150 pounds of nitrogen per acre to the following crop while its deep taproot breaks compaction. Perennial hay and pasture build organic matter steadily because the ground is never bare and never tilled. Cover crop mixes of rye and clover add organic matter, suppress weeds, and stop erosion outright.",
      "Continuous corn, cotton, and intensive vegetables deplete soil, and continuous monoculture of any crop compounds disease and pest pressure. The economics of soil building are genuinely long-term: a cover crop year produces no income by design and costs $70 an acre in seed, which looks like pure loss on a single-year budget and pays back through reduced fertilizer, better water infiltration, and more resilient yields over five to ten years. Select the soil-building priority in the tool above to weight recommendations that way.",
    ],
  },
]

/** Market, risk, and rotation questions. */
const MARKET_FAQS: Faq[] = [
  {
    q: "What is the difference between commodity, contract, and direct market crops?",
    a: [
      "Commodity crops — corn, soybeans, wheat — sell into an open market at a public price you do not control, with elevators and processors buying essentially unlimited volume. Contract crops such as sugar beets, canning vegetables, and many dry beans are grown against an agreement signed before planting, which fixes your price and removes marketing risk but usually caps acreage and specifies variety and practices. Direct market means you sell it yourself at farmers markets, through a CSA, or to restaurants and retailers.",
      "The tradeoff is price versus effort and volume. Direct marketing captures two to five times the wholesale price but requires you to become a marketer, and the volume any local market absorbs is finite. Commodity crops need no marketing skill at all but hand you a thin margin and full exposure to price swings. Most durable small and mid-sized farms end up mixing channels rather than betting everything on one.",
    ],
  },
  {
    q: "Which crops are the least risky to grow?",
    a: [
      "Small grains such as oats, barley, and winter wheat carry the lowest risk profile: stable prices, dependable yields, low input cost, minimal labor, and grain that stores for months in a dry bin while you wait for a better price. Hay is similarly forgiving. These crops rarely make anyone wealthy, but they rarely produce a disaster either.",
      "Risk concentrates in perishability and price volatility. Fresh vegetables must move within days of harvest, so a truck breakdown, a canceled restaurant order, or a heat wave at harvest can turn a profitable crop into compost. Add volatile prices and thin sales channels and the variance becomes severe. The most common way to manage this is not to pick the single safest crop but to spread across crops with different water needs, harvest windows, and buyers, so one bad event does not take the whole season.",
    ],
  },
  {
    q: "Why does crop rotation matter?",
    a: [
      "Rotation breaks pest and disease cycles that build up under continuous cropping, and it manages nitrogen. A corn-soybean rotation typically yields 10% to 15% more corn than corn grown after corn, largely from reduced rootworm pressure and the nitrogen credit the soybeans leave. Adding a third crop — a small grain or hay — improves the effect further and spreads labor and weather risk across more of the calendar.",
      "Rotation also spreads market risk. Planting three crops with different buyers and harvest windows means a price collapse or a badly timed storm hits one third of your income rather than all of it. The recommendations from the tool above are for a single field and season; treat the strongest few as candidates for a rotation rather than choosing one crop and planting it everywhere.",
    ],
  },
  {
    q: "How accurate are crop profit estimates?",
    a: [
      "Treat any projection as a planning range, not a forecast. Yields swing 30% or more with weather in a single season, and commodity prices routinely move 20% to 40% within a year. Local basis, contract terms, and organic or specialty premiums can shift the price you actually receive well beyond national averages, in either direction.",
      "The figures in these tools use typical U.S. yields, prices, and operating costs, value all labor including your own, and deliberately reduce expected yield when your land is a marginal match rather than assuming a best case. The crop selection tool stops at gross margin; the profitability calculator adds land rent, machinery, insurance, and overhead to reach a net, and lets you replace every line with your own numbers. Use them to compare crops and stress-test a plan, then build a real budget with your extension office using local enterprise figures before committing money.",
    ],
  },
]

/** Questions about the profitability calculator's budget concepts. */
const PROFIT_FAQS: Faq[] = [
  {
    q: "How do I calculate farm profit per acre?",
    a: [
      "Start with revenue: yield per acre times the price you actually receive. Subtract variable costs — seed, fertilizer, crop protection, fuel, repairs, custom work, drying, storage, trucking, and marketing — plus the value of all labor including your own. What remains is gross margin, and it tells you whether the crop is worth growing on ground you already control.",
      "Then subtract fixed costs to reach true net: land rent or mortgage, machinery depreciation and interest, crop insurance, utilities, and general farm overhead. This second step is the one most budgets skip, and it is where profitable-looking crops go negative. Corn returning a $265 gross margin an acre is losing roughly $200 once corn-belt cash rent and machinery ownership are charged against it.",
    ],
  },
  {
    q: "What is the difference between gross margin and net profit in farming?",
    a: [
      "Gross margin is revenue less variable costs and labor — the costs that exist only because you planted. Net profit subtracts fixed costs as well: rent, machinery ownership, insurance, utilities, and overhead, which you owe whether or not a crop goes in the ground. Gross margin answers whether planting beats leaving a field idle. Net profit answers whether the whole operation makes money.",
      "Both are correct for different decisions, which is why these two tools report different figures for the same crop. When you are choosing between crops on land you already farm, gross margin is the right comparison because rent and machinery are much the same whichever crop you pick. When you are deciding whether to rent more ground, buy a machine, or stay in business, only net profit matters. A farm can post a healthy gross margin every year and still slowly go broke.",
    ],
  },
  {
    q: "What is a break-even yield and break-even price?",
    a: [
      "Break-even price is the total cost per acre divided by expected yield — the price at which you exactly cover costs. Break-even yield inverts it: total cost divided by the price you expect, giving the yield you must hit. At recent input costs, corn breaks even near $5.70 a bushel over full cost and soybeans around $11, which is uncomfortably close to the prices actually on offer.",
      "It is worth calculating both against variable cost and against total cost. Above your variable break-even but below the total, you are covering the cash costs of planting and contributing something toward rent and machinery — usually better than not planting, and a normal position in a bad year. Below variable break-even, every acre you plant loses cash and planting makes things actively worse. The gap between those two numbers is the most useful thing on a crop budget.",
    ],
  },
  {
    q: "How much do land rent and machinery cost per acre?",
    a: [
      "Cash rent varies more than any other line, from $40 an acre on dryland wheat ground to $300 or more on prime corn-belt soil, and it tracks land productivity closely — which is why charging wheat corn-belt rent makes it look far worse than it is. Machinery ownership, meaning depreciation plus interest rather than fuel and repairs, typically runs $95 to $175 an acre depending on how much equipment the crop requires and how many acres it is spread across.",
      "Together these often total 30% to 45% of the full cost of a commodity crop, which is why they decide profitability more than input prices do. They also respond to different levers: spreading the same machinery over more acres lowers cost per acre, and renegotiating rent moves the number immediately. Custom hiring instead of owning converts a fixed cost into a variable one, which is usually the right trade for a machine used two weeks a year.",
    ],
  },
  {
    q: "How do I improve farm profitability?",
    a: [
      "Work on whichever line is largest first. On commodity crops that is normally land rent or machinery ownership rather than seed and fertilizer, so a 10% cut in inputs moves less money than a 15% rent renegotiation. On specialty crops the dominant costs are labor and marketing, so workflow, tooling, and price realization matter far more than land.",
      "Price and yield deserve attention before costs, because both scale the whole enterprise: a 10% better price adds more than a 10% input cut on nearly every crop, since price applies to all revenue while inputs are a fraction of it. Marketing improvements — a better contract, direct sales, storing to sell in a stronger window — are usually the highest-return work available. The calculator above ranks these levers by what each is actually worth on your acreage rather than in the abstract.",
    ],
  },
]

const ALL_FAQS = [...LEAD_FAQS, ...CONSTRAINT_FAQS, ...MARKET_FAQS, ...PROFIT_FAQS]

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

export function AgricultureGuideContent() {
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
          Crop Selection &amp; Farm Profitability FAQ
        </h2>
      </div>

      <div id="agriculture-faq" className="max-w-3xl border-t border-border">
        {ALL_FAQS.map((faq) => (
          <FaqItem key={faq.q} faq={faq} />
        ))}
      </div>
    </div>
  )
}

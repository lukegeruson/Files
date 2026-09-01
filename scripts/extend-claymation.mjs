import sharp from "sharp"

// Extend the original claymation diorama horizontally so the clay base is no
// longer cut off at the edges. We do NOT regenerate the art — we grow the
// canvas and let sharp continue the existing edge pixels outward via "mirror",
// which plausibly extends the flat sky at top and the grass/soil band below
// without inventing a new house.
const SRC = "public/solar-styles/claymation.png"
const OUT = "public/solar-styles/claymation-wide.png"

const LEFT = 190 // more on the left, where the base is actually clipped
const RIGHT = 90 // a touch on the right for balance

const img = sharp(SRC)
const meta = await img.metadata()

const extended = await img
  .extend({
    left: LEFT,
    right: RIGHT,
    extendWith: "mirror",
  })
  .png()
  .toFile(OUT)

console.log(
  `[v0] ${meta.width}x${meta.height} -> ${meta.width + LEFT + RIGHT}x${
    meta.height
  } (mirror-extended L${LEFT}/R${RIGHT})`,
)
console.log("[v0]", JSON.stringify(extended))

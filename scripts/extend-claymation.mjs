import sharp from "sharp"

// Extend the ORIGINAL claymation diorama horizontally so the clay lawn is no
// longer clipped at the sides — without regenerating the art.
//
//  - LEFT: mirror the edge so the grass/lawn continues naturally (the base is
//    clipped on this side). Mirroring also duplicates the sun, so we paint the
//    top-left sky back to clean cream to remove the second sun. The mirrored
//    trees below stay, reading as a slightly fuller treeline.
//  - RIGHT: pad with flat cream only (no mirror) so the utility pole and wires
//    are never duplicated.
const SRC = "public/solar-styles/claymation.png"
const OUT = "public/solar-styles/claymation-wide.png"

const LEFT = 205
const RIGHT = 95
const CREAM = { r: 229, g: 221, b: 213 }

// Region of the new left strip that contains the mirrored sun (sky only, above
// the grass line ~y540). Covering it with cream leaves the lawn untouched.
const COVER_W = LEFT
const COVER_H = 475

const base = sharp(SRC)
const meta = await base.metadata()

// 1) mirror-extend the left, 2) cream-pad the right.
const extended = await base
  .extend({ left: LEFT, extendWith: "mirror" })
  .extend({ right: RIGHT, background: CREAM })
  .png()
  .toBuffer()

// 3) paint clean cream over the duplicated sun in the top-left.
const cover = await sharp({
  create: {
    width: COVER_W,
    height: COVER_H,
    channels: 3,
    background: CREAM,
  },
})
  .png()
  .toBuffer()

await sharp(extended)
  .composite([{ input: cover, left: 0, top: 0 }])
  .png()
  .toFile(OUT)

console.log(
  `[v0] ${meta.width}x${meta.height} -> ${meta.width + LEFT + RIGHT}x${meta.height}`,
)

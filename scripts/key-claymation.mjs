// Chroma-keys the magenta backdrop out of the claymation diorama to produce a
// genuinely transparent PNG (real alpha channel, not a baked checkerboard).
import sharp from "sharp"
import { readFile, writeFile } from "node:fs/promises"

const SRC = "public/solar-styles/claymation-key.png"
const OUT = "public/solar-styles/claymation-transparent.png"

const img = sharp(await readFile(SRC)).ensureAlpha()
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
const { width, height, channels } = info

// Sample the top-left 8x8 block to learn the exact backdrop color.
let br = 0, bg = 0, bb = 0, n = 0
for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 8; x++) {
    const i = (y * width + x) * channels
    br += data[i]; bg += data[i + 1]; bb += data[i + 2]; n++
  }
}
br /= n; bg /= n; bb /= n
console.log("[v0] backdrop rgb:", Math.round(br), Math.round(bg), Math.round(bb))

// Magenta key: background pixels have high R, high B, low G. We score each
// pixel by how "magenta" it is, then map that to alpha with a soft ramp so
// edges stay anti-aliased instead of jagged.
const INNER = 70 // fully transparent at/above this magenta score
const OUTER = 130 // fully opaque at/below this score
let cleared = 0

for (let p = 0; p < width * height; p++) {
  const i = p * channels
  const r = data[i], g = data[i + 1], b = data[i + 2]
  // How much this pixel looks like the magenta backdrop.
  const magenta = (r + b) / 2 - g
  let alpha
  if (magenta >= OUTER) alpha = 0
  else if (magenta <= INNER) alpha = 255
  else alpha = Math.round(255 * (1 - (magenta - INNER) / (OUTER - INNER)))

  // Despill: where we keep a semi/edge pixel, pull down the magenta cast by
  // clamping R and B toward G so no pink halo remains.
  if (alpha < 255 && alpha > 0) {
    const cap = g + 30
    if (data[i] > cap) data[i] = cap
    if (data[i + 2] > cap) data[i + 2] = cap
  }
  if (alpha === 0) cleared++
  data[i + 3] = alpha
}

console.log("[v0] cleared px:", cleared, "of", width * height)

const out = await sharp(data, { raw: { width, height, channels } })
  .png()
  .toBuffer()
await writeFile(OUT, out)
console.log("[v0] wrote", OUT)

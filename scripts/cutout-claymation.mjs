// Remove the flat backdrop of the original claymation diorama by flood-filling
// from the image edges. Because the fill only spreads across contiguous
// background-colored pixels and stops at the model silhouette, the cream house
// walls and the pale sun (both interior "islands") are preserved.
import sharp from "sharp"
import path from "node:path"

const SRC = path.resolve("public/solar-styles/claymation.png")
const OUT = path.resolve("public/solar-styles/claymation-cutout.png")

// How close a pixel must be to the sampled background color to be treated as
// background (0-255 per-channel Euclidean-ish distance). Kept moderate so it
// grabs the whole backdrop without eating the model.
const HARD = 26 // fully background at/under this distance
const SOFT = 46 // fully opaque at/over this distance (soft ramp between)

const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const { width: w, height: h, channels: c } = info

// Sample the background color as the average of the four corners.
function px(x, y) {
  const i = (y * w + x) * c
  return [data[i], data[i + 1], data[i + 2]]
}
const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)]
const bg = [0, 1, 2].map(
  (k) => Math.round(corners.reduce((s, p) => s + p[k], 0) / corners.length),
)

function dist(i) {
  const dr = data[i] - bg[0]
  const dg = data[i + 1] - bg[1]
  const db = data[i + 2] - bg[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

// BFS flood fill from every edge pixel.
const visited = new Uint8Array(w * h)
const alpha = new Uint8Array(w * h).fill(255)
const queue = []
function seed(x, y) {
  const p = y * w + x
  if (!visited[p] && dist(p * c) <= SOFT) {
    visited[p] = 1
    queue.push(p)
  }
}
for (let x = 0; x < w; x++) {
  seed(x, 0)
  seed(x, h - 1)
}
for (let y = 0; y < h; y++) {
  seed(0, y)
  seed(w - 1, y)
}

let head = 0
while (head < queue.length) {
  const p = queue[head++]
  const i = p * c
  const d = dist(i)
  // Soft alpha ramp: background -> transparent, edge -> partial, model -> opaque.
  alpha[p] = d <= HARD ? 0 : d >= SOFT ? 255 : Math.round(((d - HARD) / (SOFT - HARD)) * 255)
  const x = p % w
  const y = (p / w) | 0
  const neighbors = [
    x > 0 ? p - 1 : -1,
    x < w - 1 ? p + 1 : -1,
    y > 0 ? p - w : -1,
    y < h - 1 ? p + w : -1,
  ]
  for (const np of neighbors) {
    if (np < 0 || visited[np]) continue
    if (dist(np * c) <= SOFT) {
      visited[np] = 1
      queue.push(np)
    }
  }
}

// Write the computed alpha back into the raw buffer.
for (let p = 0; p < w * h; p++) {
  if (visited[p]) data[p * c + 3] = alpha[p]
}

let cleared = 0
for (let p = 0; p < w * h; p++) if (data[p * c + 3] === 0) cleared++

await sharp(data, { raw: { width: w, height: h, channels: c } })
  .png()
  .toFile(OUT)

console.log(
  `[v0] bg=${bg.join(",")} cleared ${((cleared / (w * h)) * 100).toFixed(1)}% -> ${OUT}`,
)

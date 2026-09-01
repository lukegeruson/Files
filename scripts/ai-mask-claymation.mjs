// Computes a semantic foreground mask for the claymation diorama using the
// RMBG-1.4 segmentation model (via @huggingface/transformers, onnxruntime-node
// backend -- no fragile sharp dependency conflict).
//
// The mask is exported as a grayscale PNG (white = foreground / keep). It is
// consumed by cutout-claymation.mjs, which uses it ONLY to disambiguate the
// enclosed cream pocket between the house and the pole -- the one spot where
// cream wall and cream sky share a color and plain flood-fill leaks.
import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
} from "@huggingface/transformers"
import sharp from "sharp"
import path from "node:path"

env.allowLocalModels = false // fetch the model from the hub

const SRC = path.resolve("public/solar-styles/claymation.png")
const MASK_OUT = path.resolve("public/solar-styles/claymation-ai-mask.png")

console.log("[v0] loading RMBG-1.4 (first run downloads the model)...")
const model = await AutoModel.from_pretrained("briaai/RMBG-1.4", {
  // fp32 for a crisp matte; the model is small.
  dtype: "fp32",
})
const processor = await AutoProcessor.from_pretrained("briaai/RMBG-1.4")

console.log("[v0] running segmentation...")
// Load via sharp -> RawImage (avoids the hub image reader's file:// quirks).
const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const image = new RawImage(
  new Uint8ClampedArray(data),
  info.width,
  info.height,
  info.channels,
)
const { pixel_values } = await processor(image)
const { output } = await model({ input: pixel_values })

// output is a single-channel alpha matte in [0,1]; resize back to source size.
const matte = await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(
  image.width,
  image.height,
)

await sharp(matte.data, {
  raw: { width: matte.width, height: matte.height, channels: 1 },
})
  .png()
  .toFile(MASK_OUT)

console.log(`[v0] wrote AI mask -> ${MASK_OUT} (${image.width}x${image.height})`)

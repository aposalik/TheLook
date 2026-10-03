// Build a single "worn reference" image for a multi-piece upper look.
// Phase-0 finding: chaining two upper_body renders fails (the 2nd garment replaces
// the 1st), but compositing the uppers into ONE layered reference and rendering that
// reproduces the layering (8.5–9/10). Lowest layer sits behind at full width; each
// higher layer is drawn narrower + lower on top (e.g. a vest over an open shirt).
import sharp from "sharp";
import path from "path";

const CUTOUTS = path.join(process.cwd(), "public", "cutouts");

const W = 768;
const H = 1024;

/** Compose N upper cutouts (already ordered back→front) onto a white portrait canvas. */
export async function buildUpperCollage(cutoutIds: string[]): Promise<Buffer> {
  const layers: { input: Buffer; left: number; top: number }[] = [];
  let width = Math.round(W * 0.92); // widest layer (the base) nearly fills the frame
  let top = Math.round(H * 0.04);
  for (const id of cutoutIds) {
    const resized = await sharp(path.join(CUTOUTS, `${id}.png`))
      .trim() // drop the transparent border so each garment is tight
      .resize({ width, height: Math.round(H * 0.8), fit: "inside" })
      .toBuffer({ resolveWithObject: true });
    const left = Math.round((W - resized.info.width) / 2);
    layers.push({ input: resized.data, left, top });
    width = Math.round(width * 0.66); // next layer narrower…
    top += Math.round(H * 0.26); // …and lower, so the piece under it shows at collar + sleeves
  }
  return sharp({
    create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite(layers)
    .jpeg({ quality: 90 })
    .toBuffer();
}

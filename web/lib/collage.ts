// Build one worn-reference image for layered upper garments. A second upper-body
// VTO pass replaces the first; one composite reference preserves the layers.
import sharp from "sharp";
import path from "path";
import { readFile } from "node:fs/promises";

const CUTOUTS = path.join(process.cwd(), "public", "cutouts");
const W = 768, H = 1024;

export type CollageInput = string | { id: string; image?: string };

async function bytesFor(input: CollageInput): Promise<Buffer> {
  if (typeof input === "string") return readFile(path.join(CUTOUTS, `${input}.png`));
  if (input.image?.startsWith("data:image/")) return Buffer.from(input.image.split(",").pop()!, "base64");
  if (input.image?.startsWith("http://") || input.image?.startsWith("https://")) {
    const res = await fetch(input.image);
    if (!res.ok) throw new Error(`Could not fetch garment image: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  if (input.image?.startsWith("/")) return readFile(path.join(process.cwd(), "public", input.image.replace(/^\/+/, "")));
  return readFile(path.join(CUTOUTS, `${input.id}.png`));
}

export async function buildUpperCollage(inputs: CollageInput[]): Promise<Buffer> {
  const layers: { input: Buffer; left: number; top: number }[] = [];
  // inputs is sorted by LAYER_RANK: [base (inner), mid, outer]
  // In sharp composition, layers are composited in array order:
  // layer 0 is placed first (base inner layer), layer 1 drapes over it (outer/mid layer).
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!;
    const isBase = i === 0 && inputs.length > 1;
    // Base inner layer is fitted neatly inside (~82% width); outer layer drapes broader (~94% width)
    const targetWidth = isBase ? Math.round(W * 0.82) : Math.round(W * 0.94);
    const targetHeight = isBase ? Math.round(H * 0.78) : Math.round(H * 0.84);
    const top = isBase ? Math.round(H * 0.05) : Math.round(H * 0.035);

    const resized = await sharp(await bytesFor(input))
      .trim()
      .resize({ width: targetWidth, height: targetHeight, fit: "inside" })
      .toBuffer({ resolveWithObject: true });

    const left = Math.round((W - resized.info.width) / 2);
    layers.push({ input: resized.data, left, top });
  }

  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(layers)
    .jpeg({ quality: 90 })
    .toBuffer();
}

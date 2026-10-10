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
  if (input.image?.startsWith("/")) return readFile(path.join(process.cwd(), "public", input.image.replace(/^\/+/, "")));
  return readFile(path.join(CUTOUTS, `${input.id}.png`));
}

export async function buildUpperCollage(inputs: CollageInput[]): Promise<Buffer> {
  const layers: { input: Buffer; left: number; top: number }[] = [];
  let width = Math.round(W * 0.92);
  let top = Math.round(H * 0.04);
  for (const input of inputs) {
    const resized = await sharp(await bytesFor(input))
      .trim()
      .resize({ width, height: Math.round(H * 0.8), fit: "inside" })
      .toBuffer({ resolveWithObject: true });
    layers.push({ input: resized.data, left: Math.round((W - resized.info.width) / 2), top });
    width = Math.round(width * 0.66);
    top += Math.round(H * 0.26);
  }
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(layers)
    .jpeg({ quality: 90 })
    .toBuffer();
}

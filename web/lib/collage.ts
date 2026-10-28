// Build one worn-reference image for layered upper garments. A second upper-body
// VTO pass replaces the first; one composite reference preserves the layers.
import sharp from "sharp";
import path from "path";
import { readFile } from "node:fs/promises";

const CUTOUTS = path.join(process.cwd(), "public", "cutouts");
const W = 768, H = 1024;

export type CollageInput = string | { id: string; image?: string };
export type UpperCollagePlacement = {
  widthRatio: number;
  heightRatio: number;
  leftRatio: number;
  topRatio: number;
};

export function upperCollageLayout(count: number, _width = W, _height = H): UpperCollagePlacement[] {
  void _width;
  void _height;
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, index) => {
    if (count === 1) {
      return { widthRatio: 0.88, heightRatio: 0.8, leftRatio: 0.06, topRatio: 0.1 };
    }
    const isBase = index === 0;
    return {
      widthRatio: isBase ? 0.8 : Math.max(0.66, 0.74 - (index - 1) * 0.06),
      heightRatio: isBase ? 0.8 : 0.76,
      leftRatio: isBase ? 0.06 : 0.24 + (index - 1) * 0.06,
      topRatio: isBase ? 0.03 : 0.13 + (index - 1) * 0.06,
    };
  });
}

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
  // Visibility-oriented layered layout:
  // Keep the base shirt's collar, chest pattern, and upper torso clearly exposed
  // by placing later layers slightly narrower and offset lower/right rather than
  // occluding 94% of the canvas dead-center.
  const count = inputs.length;
  const layout = upperCollageLayout(count, W, H);
  for (let i = 0; i < count; i++) {
    const input = inputs[i]!;
    const placement = layout[i]!;
    const targetWidth = Math.round(W * placement.widthRatio);
    const targetHeight = Math.round(H * placement.heightRatio);

    const resized = await sharp(await bytesFor(input))
      .trim()
      .resize({ width: targetWidth, height: targetHeight, fit: "inside" })
      .toBuffer({ resolveWithObject: true });

    const top = count === 1
      ? Math.round((H - resized.info.height) / 2)
      : Math.round(H * placement.topRatio);
    const desiredLeft = Math.round(W * placement.leftRatio);
    const left = count === 1
      ? Math.round((W - resized.info.width) / 2)
      : Math.max(16, Math.min(W - resized.info.width - 16, desiredLeft));

    layers.push({ input: resized.data, left, top });
  }

  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(layers)
    .jpeg({ quality: 90 })
    .toBuffer();
}

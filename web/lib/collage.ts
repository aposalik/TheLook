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

/**
 * Strip solid white/cream rectangular backgrounds from uploaded garment JPEGs
 * via border flood-fill so overlaying a mid-layer or outer jacket never erases
 * the garment underneath it with an opaque white bounding box.
 */
async function stripSolidBorderBackground(rawBytes: Buffer): Promise<Buffer> {
  try {
    const { data, info } = await sharp(rawBytes)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    if (w < 8 || h < 8) return rawBytes;

    const cornerIndices = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
    if (cornerIndices.some((idx) => (data[idx + 3] ?? 255) < 40)) {
      return rawBytes;
    }

    let bgR = 255, bgG = 255, bgB = 255;
    let foundLightCorner = false;
    for (const idx of cornerIndices) {
      const r = data[idx] ?? 0;
      const g = data[idx + 1] ?? 0;
      const b = data[idx + 2] ?? 0;
      if (r >= 220 && g >= 215 && b >= 205) {
        bgR = r;
        bgG = g;
        bgB = b;
        foundLightCorner = true;
        break;
      }
    }
    if (!foundLightCorner) return rawBytes;

    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;

    const matchesBg = (pixelIndex: number): boolean => {
      const idx = pixelIndex * 4;
      const r = data[idx]!;
      const g = data[idx + 1]!;
      const b = data[idx + 2]!;
      return (
        Math.abs(r - bgR) <= 24 &&
        Math.abs(g - bgG) <= 24 &&
        Math.abs(b - bgB) <= 24 &&
        r >= 218 &&
        g >= 214 &&
        b >= 205
      );
    };

    const enqueue = (p: number) => {
      if (visited[p] === 0 && matchesBg(p)) {
        visited[p] = 1;
        queue[tail++] = p;
      }
    };

    for (let x = 0; x < w; x++) {
      enqueue(x);
      enqueue((h - 1) * w + x);
    }
    for (let y = 1; y < h - 1; y++) {
      enqueue(y * w);
      enqueue(y * w + (w - 1));
    }

    while (head < tail) {
      const p = queue[head++]!;
      data[p * 4 + 3] = 0;
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0) enqueue(p - 1);
      if (x + 1 < w) enqueue(p + 1);
      if (y > 0) enqueue(p - w);
      if (y + 1 < h) enqueue(p + w);
    }

    return await sharp(data, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toBuffer();
  } catch {
    return rawBytes;
  }
}

/**
 * Create an "open-front" version of an outer jacket/overshirt so that when placed
 * dead-center over an inner sweater/shirt, the left and right lapels part open down
 * the vertical center axis — exposing the inner garment's neckline, chest pattern,
 * and waist hem on a single anatomically aligned torso for YouCam Cloth-v4.
 */
async function createOpenFrontOuterLayer(
  pngBuffer: Buffer,
  gapRatio = 0.20,
): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  // Subtle outward shift so jacket lapels part naturally without widening shoulders
  const partShift = Math.round(w * 0.025);
  const outW = w + partShift * 2;
  const out = Buffer.alloc(outW * h * 4, 0);
  const midX = Math.floor(w / 2);
  const baseHalfGap = Math.round((w * gapRatio) / 2);
  const feather = Math.max(4, Math.round(w * 0.02));

  for (let y = 0; y < h; y++) {
    const yNorm = y / h;
    // Keep the jacket collar intact around the neck (narrower opening at top 14%)
    // and open smoothly down the chest and waist
    const collarTaper = yNorm < 0.14 ? Math.round((1 - yNorm / 0.14) * w * 0.03) : 0;
    const halfGap = Math.max(Math.round(w * 0.065), baseHalfGap - collarTaper);

    for (let x = 0; x < w; x++) {
      const distFromMid = Math.abs(x - midX);
      if (distFromMid < halfGap) continue;

      const srcIdx = (y * w + x) * 4;
      const alpha = data[srcIdx + 3]!;
      if (alpha === 0) continue;

      let fade = 1;
      if (distFromMid < halfGap + feather) {
        fade = (distFromMid - halfGap) / feather;
      }

      const dstX = x < midX ? x : x + partShift * 2;
      if (dstX < 0 || dstX >= outW) continue;
      const dstIdx = (y * outW + dstX) * 4;
      out[dstIdx] = data[srcIdx]!;
      out[dstIdx + 1] = data[srcIdx + 1]!;
      out[dstIdx + 2] = data[srcIdx + 2]!;
      out[dstIdx + 3] = Math.round(alpha * fade);
    }
  }

  const outPng = await sharp(out, { raw: { width: outW, height: h, channels: 4 } })
    .png()
    .toBuffer();
  return { data: outPng, width: outW, height: h };
}

export async function buildUpperCollage(inputs: CollageInput[]): Promise<Buffer> {
  const count = inputs.length;
  if (count === 0) {
    return sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  if (count === 1) {
    const cutout = await stripSolidBorderBackground(await bytesFor(inputs[0]!));
    const resized = await sharp(cutout)
      .trim()
      .resize({ width: Math.round(W * 0.86), height: Math.round(H * 0.8), fit: "inside" })
      .png()
      .toBuffer({ resolveWithObject: true });
    return sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
      .composite([{
        input: resized.data,
        left: Math.round((W - resized.info.width) / 2),
        top: Math.round((H - resized.info.height) / 2),
      }])
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  // First prepare the outermost layer so we know its exact torso height & bottom hem position.
  const outerCutout = await stripSolidBorderBackground(await bytesFor(inputs[count - 1]!));
  const resizedOuter = await sharp(outerCutout)
    .trim()
    .resize({ width: Math.round(W * 0.80), height: Math.round(H * 0.78), fit: "inside" })
    .png()
    .toBuffer({ resolveWithObject: true });

  const outerTop = Math.round((H - resizedOuter.info.height) / 2);
  const outerHeight = resizedOuter.info.height;
  const outerWidth = resizedOuter.info.width;

  const layers: { input: Buffer; left: number; top: number }[] = [];

  // Render inner/mid layers so their bottom hem always reaches the exact same waist line
  // as the outer jacket (never shorter/cropped, preventing exposed stomach gaps).
  for (let i = 0; i < count - 1; i++) {
    const isBaseInThree = count >= 3 && i === 0;
    const cutout = await stripSolidBorderBackground(await bytesFor(inputs[i]!));
    const trimmed = await sharp(cutout)
      .trim()
      .png()
      .toBuffer({ resolveWithObject: true });

    const innerTargetW = Math.round(outerWidth * (isBaseInThree ? 0.82 : 0.88));
    const topOffset = isBaseInThree ? Math.max(12, outerTop - 18) : outerTop;
    // Ensure inner garment reaches all the way from its top neckline down to the outer jacket's waist hem (+8px)
    const minRequiredHeight = (outerTop + outerHeight + 8) - topOffset;
    const naturalScaledHeight = Math.round((trimmed.info.height / trimmed.info.width) * innerTargetW);
    const finalHeight = Math.max(minRequiredHeight, Math.min(Math.round(H * 0.82), naturalScaledHeight));

    const resizedInner = await sharp(trimmed.data)
      .resize({
        width: innerTargetW,
        height: finalHeight,
        fit: "fill",
      })
      .png()
      .toBuffer({ resolveWithObject: true });

    const left = Math.round((W - resizedInner.info.width) / 2);
    layers.push({ input: resizedInner.data, left, top: topOffset });
  }

  // Finally composite the parted outer jacket on top
  const partedOuter = await createOpenFrontOuterLayer(resizedOuter.data, 0.20);
  const outerLeft = Math.max(8, Math.round((W - partedOuter.width) / 2));
  layers.push({ input: partedOuter.data, left: outerLeft, top: outerTop });

  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(layers)
    .jpeg({ quality: 90 })
    .toBuffer();
}

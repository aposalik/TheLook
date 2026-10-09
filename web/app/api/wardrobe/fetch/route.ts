import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const runtime = "nodejs";

function privateAddress(address: string): boolean {
  if (!isIP(address)) return true;
  if (address === "::1" || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  const p = address.split(".").map(Number);
  if (p.length !== 4) return false;
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1]! >= 16 && p[1]! <= 31) || (p[0] === 192 && p[1] === 168);
}

async function assertPublic(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Only http(s) image URLs are allowed");
  const resolved = await lookup(url.hostname, { all: true });
  if (!resolved.length || resolved.some((entry) => privateAddress(entry.address))) throw new Error("Private or local image URLs are not allowed");
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    let current = new URL(String(url));
    let response: Response | null = null;
    for (let redirect = 0; redirect < 4; redirect++) {
      await assertPublic(current);
      response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(12_000) });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Image redirect had no destination");
        current = new URL(location, current);
        continue;
      }
      break;
    }
    if (!response?.ok) throw new Error(`Could not fetch image (${response?.status ?? "unknown"})`);
    const type = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (!type.startsWith("image/")) throw new Error("The URL did not return an image");
    const advertised = Number(response.headers.get("content-length") || 0);
    if (advertised > 10_000_000) throw new Error("Image is larger than 10 MB");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 10_000_000) throw new Error("Image is larger than 10 MB");
    return NextResponse.json({ dataUrl: `data:${type};base64,${bytes.toString("base64")}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

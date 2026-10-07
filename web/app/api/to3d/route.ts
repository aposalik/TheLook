import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

// "See as 3D": turn a 2D image (the try-on result / avatar) into a viewable 3D
// model via Meshy's image-to-3D API. Runs on Meshy's GPU — nothing local.
// MOCK (no MESHY_API_KEY): returns a sample model so the viewer/flow works free.
const MODELS_DIR = path.join(process.cwd(), "public", "models");
const SAMPLE_GLB = "https://modelviewer.dev/shared-assets/models/Astronaut.glb";
const MESHY = "https://api.meshy.ai/openapi/v1/image-to-3d";

async function exists(p: string) { try { await access(p); return true; } catch { return false; } }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Accept a data: URI or a local /public path (e.g. /results/x.jpg) -> bytes + data URI.
async function loadImage(imageUrl: string): Promise<{ buf: Buffer; dataUri: string }> {
  if (imageUrl.startsWith("data:")) {
    return { buf: Buffer.from(imageUrl.split(",").pop() as string, "base64"), dataUri: imageUrl };
  }
  const rel = imageUrl.replace(/^\//, "").replace(/^public\//, "");
  const buf = await readFile(path.join(process.cwd(), "public", rel));
  return { buf, dataUri: `data:image/jpeg;base64,${buf.toString("base64")}` };
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

    const { buf, dataUri } = await loadImage(imageUrl);
    const key = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
    await mkdir(MODELS_DIR, { recursive: true });
    const cached = path.join(MODELS_DIR, `${key}.glb`);
    if (await exists(cached)) return NextResponse.json({ modelUrl: `/models/${key}.glb`, cached: true });

    // Mock: no key -> sample model so the 3D viewer can be demoed credit-free.
    if (process.env.MOCK === "1" || !process.env.MESHY_API_KEY) {
      return NextResponse.json({ modelUrl: SAMPLE_GLB, mock: true });
    }

    const auth = { Authorization: `Bearer ${process.env.MESHY_API_KEY}` };
    const create = await fetch(MESHY, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ image_url: dataUri, should_texture: true }),
    });
    if (!create.ok) throw new Error(`meshy create ${create.status}: ${(await create.text()).slice(0, 200)}`);
    const taskId = (await create.json()).result;

    let glb: string | undefined;
    for (let i = 0; i < 100; i++) {
      await sleep(3000);
      const r = await fetch(`${MESHY}/${taskId}`, { headers: auth });
      const d = await r.json();
      if (d.status === "SUCCEEDED") { glb = d.model_urls?.glb; break; }
      if (d.status === "FAILED" || d.status === "CANCELED") throw new Error(`meshy task ${d.status}`);
    }
    if (!glb) throw new Error("meshy timed out");

    // Download the glb and serve it locally (Meshy URLs expire + CORS).
    const glbBuf = Buffer.from(await (await fetch(glb)).arrayBuffer());
    await writeFile(cached, glbBuf);
    return NextResponse.json({ modelUrl: `/models/${key}.glb` });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

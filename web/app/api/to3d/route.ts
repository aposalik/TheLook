import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir, access } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";

// "See as 3D": turn a 2D image (the try-on result / avatar) into a viewable 3D
// model via Tripo3D's image-to-model API. Runs on Tripo's GPU — nothing local.
// MOCK (no TRIPO_API_KEY): returns a sample model so the viewer/flow works free.
const MODELS_DIR = path.join(process.cwd(), "public", "models");
const SAMPLE_GLB = "https://modelviewer.dev/shared-assets/models/Astronaut.glb";
const TRIPO = "https://api.tripo3d.ai/v2/openapi";

async function exists(p: string) { try { await access(p); return true; } catch { return false; } }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Accept a data: URI or a local /public path (e.g. /results/x.jpg) -> bytes.
async function loadBytes(imageUrl: string): Promise<Buffer> {
  if (imageUrl.startsWith("data:")) return Buffer.from(imageUrl.split(",").pop() as string, "base64");
  const rel = imageUrl.replace(/^\//, "").replace(/^public\//, "");
  return readFile(path.join(process.cwd(), "public", rel));
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

    const buf = await loadBytes(imageUrl);
    const key = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
    await mkdir(MODELS_DIR, { recursive: true });
    const cached = path.join(MODELS_DIR, `${key}.glb`);
    if (await exists(cached)) return NextResponse.json({ modelUrl: `/models/${key}.glb`, cached: true });

    // Mock: no key -> sample model so the 3D viewer can be demoed credit-free.
    if (process.env.MOCK === "1" || !process.env.TRIPO_API_KEY) {
      return NextResponse.json({ modelUrl: SAMPLE_GLB, mock: true });
    }

    const auth = { Authorization: `Bearer ${process.env.TRIPO_API_KEY}` };

    // 1) upload the image -> image_token
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)], { type: "image/jpeg" }), "image.jpg");
    const up = await fetch(`${TRIPO}/upload`, { method: "POST", headers: auth, body: form });
    const upJson = await up.json();
    if (!up.ok || upJson.code !== 0) throw new Error(`tripo upload: ${JSON.stringify(upJson).slice(0, 200)}`);
    const imageToken: string = upJson.data.image_token;

    // 2) create an image_to_model task -> task_id
    const create = await fetch(`${TRIPO}/task`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ type: "image_to_model", file: { type: "jpg", file_token: imageToken } }),
    });
    const createJson = await create.json();
    if (!create.ok || createJson.code !== 0) throw new Error(`tripo task: ${JSON.stringify(createJson).slice(0, 200)}`);
    const taskId: string = createJson.data.task_id;

    // 3) poll -> glb url
    let glb: string | undefined;
    for (let i = 0; i < 100; i++) {
      await sleep(3000);
      const r = await fetch(`${TRIPO}/task/${taskId}`, { headers: auth });
      const d = (await r.json()).data ?? {};
      if (d.status === "success") { glb = d.output?.pbr_model ?? d.output?.model; break; }
      if (["failed", "banned", "expired", "cancelled"].includes(d.status)) throw new Error(`tripo task ${d.status}`);
    }
    if (!glb) throw new Error("tripo timed out");

    // 4) download the glb and serve it locally (provider URLs expire + CORS)
    const glbBuf = Buffer.from(await (await fetch(glb)).arrayBuffer());
    await writeFile(cached, glbBuf);
    return NextResponse.json({ modelUrl: `/models/${key}.glb` });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// Server-side YouCam (Perfect Corp) Cloth-v4 client. Secret key stays here, never shipped to client.
const BASE = "https://yce-api-01.makeupar.com";

function authHeaders() {
  const key = process.env.PERFECTCORP_KEY;
  if (!key) throw new Error("PERFECTCORP_KEY not set");
  return { Authorization: `Bearer ${key}` };
}

/** Upload raw image bytes via the File API, return a file_id usable in a task. */
export async function uploadFile(bytes: Buffer, fileName: string, contentType = "image/jpg"): Promise<string> {
  const init = await fetch(`${BASE}/s2s/v2.0/file`, {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }] }),
  });
  if (!init.ok) throw new Error(`file-api ${init.status}: ${await init.text()}`);
  const f = (await init.json()).data.files[0];
  const put = f.requests[0];
  const up = await fetch(put.url, { method: "PUT", headers: put.headers, body: new Uint8Array(bytes) });
  if (!up.ok) throw new Error(`file-put ${up.status}`);
  return f.file_id as string;
}

export type ClothParams = {
  src_file_id?: string; src_file_url?: string;
  ref_file_id?: string; ref_file_url?: string;
  garment_category: "upper_body" | "lower_body" | "full_body";
};

export async function runCloth(params: ClothParams): Promise<string> {
  const r = await fetch(`${BASE}/s2s/v2.0/task/cloth-v4`, {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error(`task ${r.status}: ${await r.text()}`);
  const id = (await r.json()).data?.task_id;
  if (!id) throw new Error("no task_id");
  return id as string;
}

/** Poll until the result URL is ready. */
export async function pollCloth(taskId: string, timeoutMs = 180_000, intervalMs = 3000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await fetch(`${BASE}/s2s/v2.0/task/cloth-v4/${taskId}`, { headers: authHeaders() });
    const d = (await r.json()).data ?? {};
    if (d.results?.url) return d.results.url as string;
    if (d.task_status === "error" || d.task_status === "failed")
      throw new Error(`task failed: ${JSON.stringify(d).slice(0, 200)}`);
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error("poll timeout");
}

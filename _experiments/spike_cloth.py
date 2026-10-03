"""
Phase 0 spike — prove YouCam Cloth-v4 end to end.
auth -> upload full-body photo -> run task(s) -> poll -> download result image.
Tries V2 (Bearer = API key) first; falls back to V1 RSA id_token exchange.
Reads keys from ../.env.local (never printed).
"""
import os, sys, json, time, base64, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent            # _experiments
PROJ = ROOT.parent                                # FitRoom-YouCam
BASE = "https://yce-api-01.makeupar.com"

def load_env():
    d = {}
    for line in (PROJ / ".env.local").read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        d[k.strip()] = v.strip()
    return d

env = load_env()
KEY, SECRET = env["PERFECTCORP_KEY"], env["PERFECTCORP_SECRET"]
TOKEN = None

def http(method, url, headers=None, data=None, is_json=True):
    req = urllib.request.Request(url, method=method, headers=dict(headers or {}))
    body = None
    if data is not None:
        if is_json:
            body = json.dumps(data).encode(); req.add_header("content-type", "application/json")
        else:
            body = data
    try:
        r = urllib.request.urlopen(req, data=body, timeout=180)
        return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()

def ah():
    return {"Authorization": f"Bearer {TOKEN}"}

def resolve_token():
    global TOKEN
    TOKEN = KEY  # try V2 bearer = api key
    st, b = http("POST", BASE + "/s2s/v2.0/file", ah(),
                 {"files": [{"content_type": "image/jpg", "file_name": "probe.jpg", "file_size": 1000}]})
    if st == 200:
        print("[auth] V2 Bearer API-key works"); return
    print(f"[auth] bearer key -> HTTP {st}; trying V1 RSA exchange...")
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.primitives.serialization import load_der_public_key
    pub = load_der_public_key(base64.b64decode(SECRET))
    payload = f"client_id={KEY}&timestamp={int(time.time()*1000)}".encode()
    id_token = base64.b64encode(pub.encrypt(payload, padding.PKCS1v15())).decode()
    st, b = http("POST", BASE + "/s2s/v1.0/client/auth",
                 {"content-type": "application/json"}, {"client_id": KEY, "id_token": id_token})
    j = json.loads(b or b"{}")
    node = j.get("result") or j.get("data") or j
    TOKEN = node.get("access_token")
    if not TOKEN:
        raise SystemExit(f"[auth] FAILED {st}: {b[:300]!r}")
    print("[auth] V1 access_token obtained")

def upload(path):
    p = Path(path); raw = p.read_bytes()
    st, b = http("POST", BASE + "/s2s/v2.0/file", ah(),
                 {"files": [{"content_type": "image/jpg", "file_name": p.name, "file_size": len(raw)}]})
    if st != 200:
        raise SystemExit(f"[upload] {p.name} file-api {st}: {b[:300]!r}")
    f = json.loads(b)["data"]["files"][0]
    put = f["requests"][0]
    req = urllib.request.Request(put["url"], method="PUT", data=raw)
    for hk, hv in put.get("headers", {}).items():
        req.add_header(hk, str(hv))
    urllib.request.urlopen(req, timeout=180)
    print(f"[upload] {p.name} -> file_id ok ({len(raw)} bytes)")
    return f["file_id"]

def run_task(category, src_id=None, src_url=None, ref_id=None, ref_url=None):
    payload = {"garment_category": category}
    if src_id: payload["src_file_id"] = src_id
    if src_url: payload["src_file_url"] = src_url
    if ref_id: payload["ref_file_id"] = ref_id
    if ref_url: payload["ref_file_url"] = ref_url
    st, b = http("POST", BASE + "/s2s/v2.0/task/cloth-v4", ah(), payload)
    j = json.loads(b or b"{}")
    tid = (j.get("data") or j.get("result") or {}).get("task_id")
    print(f"[task] {category} -> HTTP {st} task_id={(tid or '')[:18]}")
    if not tid:
        raise SystemExit(f"[task] FAILED {st}: {b[:400]!r}")
    return tid

def poll(tid, label):
    for _ in range(80):
        st, b = http("GET", f"{BASE}/s2s/v2.0/task/cloth-v4/{tid}", ah())
        d = (json.loads(b or b"{}").get("data") or {})
        status = d.get("task_status")
        if d.get("results"):
            url = d["results"]["url"]
            out = ROOT / "testimg" / f"spike_{label}.jpg"
            out.write_bytes(urllib.request.urlopen(url, timeout=180).read())
            print(f"[poll] {label}: success -> saved {out.name} ({out.stat().st_size} bytes)")
            return str(out)
        if status in ("error", "failed"):
            print(f"[poll] {label}: {status} :: {json.dumps(d)[:300]}")
            return None
        time.sleep(3)
    print(f"[poll] {label}: TIMEOUT")
    return None

if __name__ == "__main__":
    resolve_token()
    body = upload("testimg/full-body.jpg")
    shirt = upload("catalog/top_84_mens-shirts.jpg")
    SAMPLE_FULL = "https://plugins-media.makeupar.com/strapi/assets/clothes_reference_full_body_01_5a000d999f.png"
    print("\n--- Test 1: our photo + single upper_body garment (our catalog shirt) ---")
    poll(run_task("upper_body", src_id=body, ref_id=shirt), "upper_shirt")
    print("\n--- Test 2: our photo + full_body outfit reference (sample) ---")
    poll(run_task("full_body", src_id=body, ref_url=SAMPLE_FULL), "full_outfit")
    print("\nDONE.")

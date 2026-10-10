"""
Phase 1 — offline catalog pipeline.
Input: a folder of {slot}_{name}.jpg product images (_experiments/capsule/).
Output:
  data/catalog.json + web/data/catalog.json             : [{id, slot, title, color, palette, image, src, ...tags}]
  data/compat_matrix.json + web/data/compat_matrix.json : { id: { other_id: symmetrized_compat 0-1 } }
  web/public/cutouts/*.png  : rembg display cutouts (NOT used for embeddings)
  web/public/garments/*.jpg : raw JPEG reference images used by Cloth-v4 try-on
Embeddings use the RAW image (rembg cleaning hurts compat — verified).

Styling tags (category, layer, formality, fit, color_role, ...) live in
_experiments/catalog_tags.json. Items without tags are auto-tagged with Gemini
Vision (GEMINI_API_KEY from env or .env.local) and the result is saved back to
that file, so each item is only sent to Gemini once. "manual" entries are never
overwritten.

Usage:
  python catalog_pipeline.py                 # full run + spot-check
  python catalog_pipeline.py --no-spotcheck  # used by the web "Add to store catalog" flow
  python catalog_pipeline.py --retag ID      # force Gemini re-tagging of one item
"""
import sys, io, os, json, base64, colorsys, argparse, shutil, urllib.request, urllib.error
from pathlib import Path
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans

EXP = Path(__file__).resolve().parent
ROOT = EXP.parent
WEB = ROOT / "web"
sys.path.insert(0, str(EXP))

CAPSULE = EXP / "capsule"
TAGS_FILE = EXP / "catalog_tags.json"
DATA_DIRS = [ROOT / "data", WEB / "data"]            # web/data is what Next.js imports
CUT = WEB / "public" / "cutouts"
GARMENTS = WEB / "public" / "garments"
for d in [*DATA_DIRS, CUT, GARMENTS]:
    d.mkdir(parents=True, exist_ok=True)

# filename slot -> recommender category / default layer (used when tags are missing)
SLOT_DEFAULTS = {
    "top":       {"category": "upper",     "layer": "base"},
    "outerwear": {"category": "upper",     "layer": "outer"},
    "bottom":    {"category": "bottom",    "layer": None},
    "dress":     {"category": "dress",     "layer": None},
    "shoe":      {"category": "shoe",      "layer": None},
    "accessory": {"category": "accessory", "layer": None},
}
CATEGORIES = {"upper", "bottom", "shoe", "accessory", "dress"}
LAYERS = {"base", "mid", "outer"}
FITS = {"slim", "regular", "relaxed", "baggy"}
COLOR_ROLES = {"neutral", "accent"}
RENDERABLE = {"upper", "bottom", "dress"}             # Cloth-v4 has no shoe/accessory category


def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------- env / Gemini
def load_env():
    """Fill missing GEMINI_* vars from web/.env.local or root .env.local (no extra deps)."""
    for f in (WEB / ".env.local", ROOT / ".env.local"):
        if not f.exists():
            continue
        for line in f.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k.startswith("GEMINI_") and v and not os.environ.get(k):
                os.environ[k] = v


GEMINI_PROMPT = """You are a fashion cataloging system. Inspect the garment or accessory in the image and return JSON only.
Required schema:
{
  "title": "short ecommerce product name",
  "category": "upper|bottom|shoe|accessory|dress",
  "subcategory": "t-shirt|overshirt|jeans|sneaker|bag etc",
  "layer": "base|mid|outer|null",
  "formality": 1,
  "fit": "slim|regular|relaxed|baggy",
  "colorRole": "neutral|accent",
  "seasons": ["spring","summer","autumn","winter"],
  "styles": ["minimal","streetwear","smart-casual"],
  "material": "best visual estimate",
  "description": "one factual sentence"
}
Rules: classify what is visibly present, do not invent branding, set layer only for upper garments
(base = worn alone like tee/polo/knit, mid = shirt/vest worn open or over, outer = jacket/coat/cardigan),
formality is 1 casual to 5 formal. The filename hint is '{hint}', but visual evidence wins."""


def gemini_tag(path: Path, slot: str):
    """Ask Gemini Vision for styling tags. Returns a normalized dict or None on any failure."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    model = os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash"
    im = Image.open(path).convert("RGB")
    im.thumbnail((512, 512))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=85)
    body = {
        "contents": [{"role": "user", "parts": [
            {"text": GEMINI_PROMPT.replace("{hint}", f"{slot}: {path.stem}")},
            {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(buf.getvalue()).decode()}},
        ]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.15, "maxOutputTokens": 2048},
    }
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json", "x-goog-api-key": key},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            resp = json.load(r)
        text = "".join(p.get("text", "") for p in resp["candidates"][0]["content"]["parts"])
        text = text.replace("```json", "").replace("```", "").strip()
        raw = json.loads(text[text.index("{"): text.rindex("}") + 1])
    except urllib.error.HTTPError as e:
        log(f"[gemini] {path.stem}: HTTP {e.code} {e.read()[:200]!r} (model={model})")
        return None
    except Exception as e:  # network, JSON, schema
        log(f"[gemini] {path.stem}: failed ({e})")
        return None
    return normalize_tags(raw, slot, source="gemini")


def normalize_tags(raw: dict, slot: str, source: str) -> dict:
    d = SLOT_DEFAULTS.get(slot, SLOT_DEFAULTS["top"])
    cat = raw.get("category") if raw.get("category") in CATEGORIES else d["category"]
    layer = raw.get("layer") if cat == "upper" and raw.get("layer") in LAYERS else (d["layer"] if cat == "upper" else None)
    try:
        formality = max(1, min(5, int(round(float(raw.get("formality", 2))))))
    except (TypeError, ValueError):
        formality = 2
    out = {
        "category": cat,
        "layer": layer,
        "formality": formality,
        "fit": raw.get("fit") if raw.get("fit") in FITS else "regular",
        "color_role": raw.get("colorRole", raw.get("color_role")) if raw.get("colorRole", raw.get("color_role")) in COLOR_ROLES else "neutral",
        "source": source,
    }
    for k, n in (("title", 80), ("subcategory", 40), ("material", 40), ("description", 240)):
        if raw.get(k):
            out[k] = str(raw[k])[:n]
    for k in ("seasons", "styles"):
        if isinstance(raw.get(k), list):
            out[k] = [str(x) for x in raw[k]][:5]
    return out


def default_tags(slot: str) -> dict:
    d = SLOT_DEFAULTS.get(slot, SLOT_DEFAULTS["top"])
    return {**d, "formality": 2, "fit": "regular", "color_role": "neutral", "source": "default"}


# ---------------------------------------------------------------- color
def dominant(cut_rgba):
    """Dominant garment color from the cutout's NON-transparent pixels (ignore background)."""
    im = cut_rgba.convert("RGBA").resize((96, 96))
    arr = np.asarray(im).reshape(-1, 4).astype(float)
    px = arr[arr[:, 3] > 30][:, :3]           # keep only opaque (garment) pixels
    if len(px) < 10:
        px = arr[:, :3]
    km = KMeans(n_clusters=3, n_init=4, random_state=0).fit(px)
    r, g, b = (int(x) for x in km.cluster_centers_[np.bincount(km.labels_).argmax()])
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    hd = h * 360
    pal = "neutral" if s < 0.15 else ("cool" if 70 <= hd <= 200 else "warm")
    return f"#{r:02x}{g:02x}{b:02x}", pal


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-spotcheck", action="store_true", help="skip the complete-the-look printout")
    ap.add_argument("--retag", action="append", default=[], help="force Gemini re-tagging of this item id")
    args = ap.parse_args()

    load_env()
    tags = json.loads(TAGS_FILE.read_text()) if TAGS_FILE.exists() else {}

    import recommend as R                      # heavy (torch/open_clip) — import after arg parsing
    from rembg import remove

    rec = R.Recommender()
    rec.build(CAPSULE, clean=False)            # raw embeddings (cached in .emb_cache/)

    catalog, tagged_now, warnings = [], [], []
    for it in rec.items:
        p = it["path"]; stem = p.stem; slot = it["slot"]
        if slot not in SLOT_DEFAULTS:
            warnings.append(f"{p.name}: unknown slot '{slot}' (expected {sorted(SLOT_DEFAULTS)})")

        # 1. tags: manual/saved -> Gemini -> slot defaults
        t = tags.get(stem)
        if t is None or stem in args.retag:
            g = gemini_tag(p, slot)
            if g:
                if t and t.get("source") == "manual" and stem not in args.retag:
                    g = t
                tags[stem] = t = g
                tagged_now.append(stem)
                log(f"[gemini] tagged {stem}: {t['category']}/{t.get('layer')} formality={t['formality']} fit={t['fit']}")
            elif t is None:
                t = default_tags(slot)
                warnings.append(f"{stem}: no tags and Gemini unavailable -> slot defaults used")

        # 2. background-removed display cutout
        cut = CUT / f"{stem}.png"
        if cut.exists() and cut.stat().st_mtime >= p.stat().st_mtime:
            cut_img = Image.open(cut).convert("RGBA")
        else:
            cut_img = Image.open(io.BytesIO(remove(p.read_bytes()))).convert("RGBA")
            cut_img.save(cut)
            log(f"[rembg] cutout -> {cut.relative_to(ROOT)}")

        # 3. raw JPEG reference for Cloth-v4 try-on (renderable garments only)
        if t["category"] in RENDERABLE:
            g_path = GARMENTS / f"{stem}.jpg"
            if not g_path.exists() or g_path.stat().st_mtime < p.stat().st_mtime:
                if p.suffix.lower() in {".jpg", ".jpeg"}:
                    shutil.copyfile(p, g_path)
                else:
                    Image.open(p).convert("RGB").save(g_path, "JPEG", quality=92)

        # 4. dominant color + palette from the cutout
        hexc, pal = dominant(cut_img)
        entry = {k: v for k, v in t.items() if k != "source"}
        catalog.append({
            "id": stem,
            "slot": slot,
            "title": entry.pop("title", None) or stem.split("_", 1)[-1].replace("-", " ").title(),
            "color": hexc,
            "palette": pal,
            "image": f"/cutouts/{stem}.png",
            "src": str(p.relative_to(ROOT)),
            **entry,
            "tag_source": t.get("source", "manual"),
        })

    if tagged_now:
        TAGS_FILE.write_text(json.dumps(tags, indent=2) + "\n")
        log(f"[tags] saved {len(tagged_now)} Gemini tag set(s) -> {TAGS_FILE.relative_to(ROOT)}")

    # 5. OpenCLIP 512-d embeddings -> symmetrized Polyvore compat matrix
    emb = {it["path"].stem: it["emb"] for it in rec.items}
    stems = list(emb)
    matrix = {a: {b: round(rec._compat(emb[a], emb[b]), 4) for b in stems if b != a} for a in stems}

    for d in DATA_DIRS:
        (d / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n")
        (d / "compat_matrix.json").write_text(json.dumps(matrix, indent=2) + "\n")
    log(f"[pipeline] wrote catalog.json ({len(catalog)} items) + compat_matrix.json ({len(stems)}²) + {len(stems)} cutouts")
    log(f"[pipeline] data -> {', '.join(str(d.relative_to(ROOT)) for d in DATA_DIRS)}")
    for w in warnings:
        log(f"[warn] {w}")

    # machine-readable summary for the web "Add to store catalog" route
    log("[result] " + json.dumps({"items": len(catalog), "tagged": tagged_now, "warnings": warnings}))

    if args.no_spotcheck:
        return
    # --- spot-check: complete-the-look for the first top / bottom / dress ---
    for slot in ("top", "bottom", "dress"):
        anchor = next((i["name"] for i in rec.items if i["slot"] == slot), None)
        if not anchor:
            continue
        a, look, score = rec.complete_look(anchor)
        log(f"\nANCHOR {a['name']}  → cohesion {score:.2f}")
        for it in look:
            tag = "ANCHOR" if it["name"] == a["name"] else it["slot"]
            log(f"   [{tag:9}] {it['name']}")


if __name__ == "__main__":
    main()

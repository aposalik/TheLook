"""
Phase 1 — offline catalog pipeline.
Input: a folder of {slot}_{name}.jpg product images.
Output (to ../data and ../public/cutouts):
  catalog.json        : [{id, slot, title, color, palette, image, src}]
  compat_matrix.json  : { id: { other_id: symmetrized_compat 0-1 } }
  public/cutouts/*.png: rembg display cutouts (NOT used for embeddings)
Embeddings use the RAW image (rembg cleaning hurts compat — verified).
"""
import sys, io, json, colorsys
from pathlib import Path
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans

EXP = Path(__file__).resolve().parent
sys.path.insert(0, str(EXP))
import recommend as R
from rembg import remove

CAPSULE = EXP / "capsule"
DATA = EXP.parent / "data"
CUT = EXP.parent / "public" / "cutouts"
DATA.mkdir(exist_ok=True); CUT.mkdir(parents=True, exist_ok=True)

# Hand-authored styling tags (capsule is small). category: upper|bottom|dress|shoe|accessory
# layer (uppers only): base (tee/polo/knit worn alone) | mid (shirt/vest worn open/over) | outer (jacket/cardigan)
# formality 1(casual)..5(formal) · fit slim|regular|baggy · color_role neutral|accent
TAGS = {
    "top_shirt-blue":          {"category": "upper", "layer": "mid",  "formality": 3, "fit": "regular", "color_role": "neutral"},
    "top_shirt-gray":          {"category": "upper", "layer": "mid",  "formality": 3, "fit": "regular", "color_role": "neutral"},
    "top_polo-cream":          {"category": "upper", "layer": "base", "formality": 2, "fit": "regular", "color_role": "neutral"},
    "top_sweater-navy":        {"category": "upper", "layer": "base", "formality": 2, "fit": "regular", "color_role": "neutral"},
    "top_vest-brown":          {"category": "upper", "layer": "mid",  "formality": 3, "fit": "regular", "color_role": "neutral"},
    "outerwear_cardigan-brown":{"category": "upper", "layer": "outer","formality": 3, "fit": "regular", "color_role": "neutral"},
    "bottom_trousers-brown":   {"category": "bottom","layer": None,   "formality": 3, "fit": "regular", "color_role": "neutral"},
    "bottom_jeans-lightblue":  {"category": "bottom","layer": None,   "formality": 2, "fit": "baggy",   "color_role": "neutral"},
    "bottom_corduroy-gray":    {"category": "bottom","layer": None,   "formality": 2, "fit": "regular", "color_role": "neutral"},
    "bottom_baggy-jeans":      {"category": "bottom","layer": None,   "formality": 1, "fit": "baggy",   "color_role": "neutral"},
    # shoes & accessories: card-only styling pieces (Cloth-v4 has no shoe/accessory
    # category, so they enrich the recommendation but are never individually rendered).
    "shoe_sneakers-red":       {"category": "shoe",     "layer": None, "formality": 1, "fit": "regular", "color_role": "accent"},
    "accessory_sunglasses-brown":{"category": "accessory","layer": None,"formality": 2, "fit": "regular", "color_role": "neutral"},
    "accessory_bag-blue":      {"category": "accessory", "layer": None, "formality": 2, "fit": "regular", "color_role": "accent"},
}

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

rec = R.Recommender()
rec.build(CAPSULE, clean=False)                      # raw embeddings (cached)

catalog = []
for it in rec.items:
    p = it["path"]; stem = p.stem
    cut = CUT / f"{stem}.png"
    if cut.exists():
        cut_img = Image.open(cut).convert("RGBA")
    else:
        cut_img = Image.open(io.BytesIO(remove(p.read_bytes()))).convert("RGBA")
        cut_img.save(cut)
    hexc, pal = dominant(cut_img)
    catalog.append({
        "id": stem,
        "slot": it["slot"],
        "title": stem.split("_", 1)[1].replace("-", " ").title(),
        "color": hexc,
        "palette": pal,
        "image": f"/cutouts/{stem}.png",
        "src": str(p.relative_to(EXP.parent)),
        **TAGS.get(stem, {}),
    })

emb = {it["path"].stem: it["emb"] for it in rec.items}
stems = list(emb)
matrix = {a: {b: round(rec._compat(emb[a], emb[b]), 4) for b in stems if b != a} for a in stems}

json.dump(catalog, open(DATA / "catalog.json", "w"), indent=2)
json.dump(matrix, open(DATA / "compat_matrix.json", "w"), indent=2)
print(f"[pipeline] wrote catalog.json ({len(catalog)} items) + compat_matrix.json ({len(stems)}²) + {len(stems)} cutouts")
print(f"[pipeline] data -> {DATA}")

# --- spot-check: complete-the-look for a few anchors ---
for anchor in ["top_shirt-blue.jpg", "bottom_trousers-brown.jpg", "top_sweater-navy.jpg"]:
    a, look, score = rec.complete_look(anchor)
    print(f"\nANCHOR {a['name']}  → cohesion {score:.2f}")
    for it in look:
        tag = "ANCHOR" if it["name"] == a["name"] else it["slot"]
        print(f"   [{tag:9}] {it['name']}")

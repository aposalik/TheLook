"""
FitRoom — outfit recommender (credit-free core).

Pipeline:  rembg clean -> CLIP embed (cached) -> compatibility-MLP rank -> complete-the-look.
Uses EESHAK02/style-recommender's OpenCLIP ViT-B-32 + shipped Polyvore-trained compat MLP.
No YouCam credits are spent here; this only decides WHICH items to render later.

Usage:
    python recommend.py --catalog catalog --anchor top_84_mens-shirts.jpg
    python recommend.py --catalog catalog --anchor top_84_mens-shirts.jpg --no-clean
"""
from __future__ import annotations
import argparse, io, sys, time, hashlib
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image
import torch

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "style-recommender"))
import core  # noqa: E402

# --- device: prefer Apple GPU (MPS), else CPU. Set BEFORE loading models. ---
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"
core.DEVICE = DEVICE

CACHE = ROOT / ".emb_cache"
CACHE.mkdir(exist_ok=True)

# Which slots complete a given anchor slot (a dress already covers top+bottom).
COMPLEMENTS = {
    "top":       ["bottom", "shoe", "outerwear", "accessory"],
    "bottom":    ["top", "shoe", "outerwear", "accessory"],
    "dress":     ["shoe", "outerwear", "accessory"],
    "shoe":      ["top", "bottom", "dress", "outerwear", "accessory"],
    "outerwear": ["top", "bottom", "dress", "shoe", "accessory"],
    "accessory": ["top", "bottom", "dress", "shoe", "outerwear"],
}


def _slot_of(path: Path) -> str:
    return path.name.split("_")[0]


def clean_on_white(img_bytes: bytes) -> Image.Image:
    """rembg cut-out composited on white -> matches the model's Polyvore training domain."""
    from rembg import remove
    cut = Image.open(io.BytesIO(remove(img_bytes))).convert("RGBA")
    white = Image.new("RGBA", cut.size, (255, 255, 255, 255))
    return Image.alpha_composite(white, cut).convert("RGB")


class Recommender:
    def __init__(self):
        t = time.time()
        self.clip, self.preprocess, self.classifier = core.load_trained_models_for_inference()
        print(f"[init] models on {DEVICE} ({time.time()-t:.1f}s)")
        self.items: list[dict] = []  # {name, slot, path, emb(np[512]), cutout}

    # ---- embedding with on-disk cache keyed by (file bytes + clean flag) ----
    def _embed(self, img: Image.Image) -> np.ndarray:
        emb = core.encode_single_image(self.clip, self.preprocess, img)  # tensor [1,512] on DEVICE
        return emb.detach().cpu().numpy().reshape(-1)

    def add(self, path: Path, clean: bool = True):
        raw = path.read_bytes()
        key = hashlib.sha1(raw + (b"clean" if clean else b"raw")).hexdigest()[:16]
        cache_f = CACHE / f"{key}.npy"
        img = clean_on_white(raw) if clean else Image.open(io.BytesIO(raw)).convert("RGB")
        if cache_f.exists():
            emb = np.load(cache_f)
        else:
            emb = self._embed(img)
            np.save(cache_f, emb)
        self.items.append({"name": path.name, "slot": _slot_of(path), "path": path, "emb": emb})

    def build(self, catalog_dir: Path, clean: bool = True):
        files = sorted(p for p in catalog_dir.glob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
        t = time.time()
        for p in files:
            self.add(p, clean=clean)
        print(f"[build] {len(self.items)} items embedded ({time.time()-t:.1f}s, cache={CACHE.name})")

    # ---- compatibility from precomputed embeddings (no re-encode) ----
    # NOTE: the shipped compat MLP is ASYMMETRIC (compat(a,b) != compat(b,a),
    # e.g. top,shoe=0.10 vs shoe,top=0.74). We symmetrize by averaging both
    # orders so a pairing's score doesn't depend on which item is the anchor.
    def _compat(self, e1: np.ndarray, e2: np.ndarray) -> float:
        t1 = torch.from_numpy(e1).unsqueeze(0).to(DEVICE)
        t2 = torch.from_numpy(e2).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            p_ab = torch.sigmoid(self.classifier(t1, t2)).item()
            p_ba = torch.sigmoid(self.classifier(t2, t1)).item()
        return (p_ab + p_ba) / 2.0

    def _find(self, name: str) -> dict:
        for it in self.items:
            if it["name"] == name:
                return it
        raise SystemExit(f"anchor '{name}' not in catalog. have: {[i['name'] for i in self.items]}")

    def rank_complements(self, anchor_name: str, slot: Optional[str] = None, k: int = 3):
        a = self._find(anchor_name)
        out = []
        for it in self.items:
            if it["name"] == a["name"] or it["slot"] == a["slot"]:
                continue  # skip self and same-slot (we want complements, not duplicates)
            if slot and it["slot"] != slot:
                continue
            out.append((self._compat(a["emb"], it["emb"]), it))
        out.sort(key=lambda x: -x[0])
        return a, out[:k]

    def complete_look(self, anchor_name: str):
        a = self._find(anchor_name)
        picked = {}
        for s in COMPLEMENTS.get(a["slot"], []):
            cands = [(self._compat(a["emb"], it["emb"]), it) for it in self.items if it["slot"] == s]
            if cands:
                picked[s] = max(cands, key=lambda x: x[0])  # (score, item)
        # exclusivity: a dress replaces top+bottom — keep whichever suits the anchor better
        if "dress" in picked and ("top" in picked or "bottom" in picked):
            tb = [picked[s][0] for s in ("top", "bottom") if s in picked]
            if picked["dress"][0] >= sum(tb) / len(tb):
                picked.pop("top", None); picked.pop("bottom", None)
            else:
                picked.pop("dress", None)
        chosen = [a] + [v[1] for v in picked.values()]
        # overall cohesion = mean pairwise compat across the chosen set
        pairs = [(chosen[i], chosen[j]) for i in range(len(chosen)) for j in range(i + 1, len(chosen))]
        score = float(np.mean([self._compat(x["emb"], y["emb"]) for x, y in pairs])) if pairs else 0.0
        return a, chosen, score


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalog", default="catalog")
    ap.add_argument("--anchor", required=True)
    ap.add_argument("--no-clean", action="store_true", help="skip rembg (embed raw image)")
    ap.add_argument("--k", type=int, default=3)
    args = ap.parse_args()

    rec = Recommender()
    rec.build(ROOT / args.catalog, clean=not args.no_clean)

    a, ranked = rec.rank_complements(args.anchor, k=args.k)
    print(f"\nANCHOR: {a['name']}  [slot={a['slot']}]")
    print(f"top {args.k} complements (any slot):")
    for prob, it in ranked:
        print(f"  {prob:4.2f}  [{it['slot']:9}] {it['name']}")

    a, look, score = rec.complete_look(args.anchor)
    print(f"\nCOMPLETE THE LOOK  (cohesion {score:4.2f} / 1.00):")
    for it in look:
        tag = "ANCHOR" if it["name"] == a["name"] else it["slot"]
        print(f"  [{tag:9}] {it['name']}")


if __name__ == "__main__":
    main()

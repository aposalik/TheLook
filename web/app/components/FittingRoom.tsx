"use client";
import { useEffect, useState } from "react";
import TopBar from "./TopBar";
import AvatarStage from "./AvatarStage";
import WearingPanel from "./WearingPanel";
import WardrobeCatalog from "./WardrobeCatalog";
import AddItemModal, { type RowKey } from "./AddItemModal";
import BagDrawer from "./BagDrawer";
import Lookbook, { type SavedLook } from "./Lookbook";
import LookDetail, { type DetailLook } from "./LookDetail";

import type { Item, Look, StylePreferences } from "@/lib/recommend";
type Avatar = { id: string; url: string };
const AV_KEY = "thelook_avatars";
const LOOKS_KEY = "thelook_looks";
const WARDROBE_KEY = "thelook_wardrobe";
const PREFS_KEY = "thelook_style_preferences";

/** Downscale an uploaded image so localStorage stays small and uploads are fast. */
function downscale(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject; img.src = r.result as string;
    };
    r.onerror = reject; r.readAsDataURL(file);
  });
}

export default function FittingRoom({ catalog }: { catalog: Item[] }) {
  const [equipped, setEquipped] = useState<Item[]>([]);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [currentLook, setCurrentLook] = useState<Look | null>(null);

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [activeAvatarId, setActiveAvatarId] = useState<string | null>(null);
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [mockPreview, setMockPreview] = useState<{ photo: string; garment: string; title: string } | null>(null);
  const [isTryOnLoading, setIsTryOnLoading] = useState(false);
  const [tryOnError, setTryOnError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [cart, setCart] = useState<Item[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);
  const [lookbookOpen, setLookbookOpen] = useState(false);
  const [detailLook, setDetailLook] = useState<DetailLook | null>(null);

  const [userItems, setUserItems] = useState<Item[]>([]);
  const [preferences, setPreferences] = useState<StylePreferences>({ occasion: "any", goal: "balanced" });
  const [stylistSource, setStylistSource] = useState<"gemini" | "deterministic" | null>(null);
  const [addModal, setAddModal] = useState<RowKey | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ---- saved avatars: persisted to localStorage, switchable ----
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(AV_KEY) || "[]") as Avatar[];
      // Browser persistence is an external store; hydrate it once after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvatars(saved);
      if (saved[0]) { setActiveAvatarId(saved[0].id); setCustomPhoto(saved[0].url); }
      setSavedLooks(JSON.parse(localStorage.getItem(LOOKS_KEY) || "[]") as SavedLook[]);
      setUserItems(JSON.parse(localStorage.getItem(WARDROBE_KEY) || "[]") as Item[]);
      setPreferences(JSON.parse(localStorage.getItem(PREFS_KEY) || '{"occasion":"any","goal":"balanced"}') as StylePreferences);
    } catch { /* ignore */ }
  }, []);

  function persistUserItems(next: Item[]) {
    setUserItems(next);
    localStorage.setItem(WARDROBE_KEY, JSON.stringify(next));
  }

  function addUserItem(item: Item) {
    persistUserItems([item, ...userItems]);
    showToast(`Added "${item.title}" to your wardrobe`);
  }

  function removeUserItem(id: string) {
    persistUserItems(userItems.filter((i) => i.id !== id));
    setEquipped((prev) => prev.filter((i) => i.id !== id));
    if (activeItem?.id === id) setActiveItem(null);
  }

  function persistAvatars(next: Avatar[]) {
    setAvatars(next);
    localStorage.setItem(AV_KEY, JSON.stringify(next));
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await downscale(file);
    const av: Avatar = { id: crypto.randomUUID(), url };
    persistAvatars([...avatars, av]);
    setActiveAvatarId(av.id);
    setCustomPhoto(url);
    setTryOnResult(null); setMockPreview(null);
    showToast("Photo saved — build a look, then Show on me");
  }

  function selectAvatar(id: string) {
    const av = avatars.find((a) => a.id === id);
    if (!av) return;
    setActiveAvatarId(id); setCustomPhoto(av.url);
    setTryOnResult(null); setMockPreview(null);
  }

  function removeAvatar(id: string) {
    const next = avatars.filter((a) => a.id !== id);
    persistAvatars(next);
    if (activeAvatarId === id) {
      const first = next[0] ?? null;
      setActiveAvatarId(first?.id ?? null);
      setCustomPhoto(first?.url ?? null);
      setTryOnResult(null); setMockPreview(null);
    }
  }

  function toggleEquip(item: Item) {
    setActiveItem(item);
    setTryOnResult(null);
    setMockPreview(null);
    setEquipped((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) return prev.filter((i) => i.id !== item.id);
      // Allow a real layered outfit: one base, one mid and one outer. Bottoms,
      // shoes and dresses remain mutually exclusive; accessories can stack.
      const key = (value: Item) => {
        const category = value.category ?? value.slot;
        if (category === "upper" || value.slot === "top" || value.slot === "outerwear") return `upper:${value.layer ?? "base"}`;
        if (category === "accessory") return `accessory:${value.id}`;
        return category;
      };
      const next = prev.filter((existing) => key(existing) !== key(item));
      return [...next, item];
    });
  }

  function updatePreferences(next: StylePreferences) {
    setPreferences(next);
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  }

  function removeEquipped(item: Item) {
    setEquipped((prev) => prev.filter((i) => i.id !== item.id));
    if (activeItem?.id === item.id) setActiveItem(null);
  }

  // Deterministic constructor creates five grounded candidates. Gemini Vision
  // can rerank/explain them, but a failure always falls back to deterministic results.
  async function generateOutfit() {
    const anchorIds = equipped.length > 0
      ? equipped.map((i) => i.id)
      : activeItem ? [activeItem.id] : [catalog[0]?.id].filter(Boolean) as string[];
    if (anchorIds.length === 0) return;
    setIsGenerating(true);
    setGenerateError(null);
    setStylistSource(null);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anchors: anchorIds, wardrobeItems: userItems, preferences }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      let looks: Look[] = data.looks ?? [];
      if (!looks.length) throw new Error("No compatible outfits found. Try removing a conflicting piece.");

      const stylist = await fetch("/api/stylist/rerank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidates: looks, preferences }),
      });
      const styled = await stylist.json();
      if (stylist.ok && Array.isArray(styled.looks) && styled.looks.length) looks = styled.looks;
      setStylistSource(styled.source === "gemini" ? "gemini" : "deterministic");

      const top = looks[0]!;
      setCurrentLook(top);
      setEquipped(top.items);
      setActiveItem(top.items[0] ?? null);
      showToast(`${styled.source === "gemini" ? "Gemini stylist" : "Outfit engine"} picked the best look · ${(top.cohesion * 100).toFixed(0)}% cohesion`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setGenerateError(msg);
      showToast(`Generate failed: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  }

  // POST /api/tryon-look { photoBase64, itemIds } — renders the WHOLE outfit
  // (collage the uppers + chain the bottom), not a single garment.
  async function renderLook(photo: string, items: Item[]) {
    setIsTryOnLoading(true);
    setTryOnError(null);
    setMockPreview(null);
    setTryOnResult(null);

    try {
      const res = await fetch("/api/tryon-look", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoBase64: photo, itemIds: items.map((i) => i.id), items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      if (data.mock) {
        setMockPreview({ photo, garment: data.resultUrl, title: "your look" });
      } else {
        setTryOnResult(data.resultUrl);
      }
      showToast(data.mock ? "Mock preview ready" : "Try-on render complete!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTryOnError(msg);
      showToast(`Try-on failed: ${msg}`);
    } finally {
      setIsTryOnLoading(false);
    }
  }

  async function runTryOn() {
    if (!customPhoto) { showToast("Upload your photo first"); return; }
    const items = equipped.length ? equipped : currentLook?.items ?? [];
    if (!items.length) { showToast("Build or generate a look first"); return; }
    await renderLook(customPhoto, items);
  }

  function addToBag() {
    if (equipped.length === 0) return;
    setCart((prev) => [...prev, ...equipped]);
    showToast(`${equipped.length} item${equipped.length !== 1 ? "s" : ""} added to bag`);
  }

  function removeFromBag(id: string) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx === -1) return prev;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  }

  // ---- lookbook: save/review outfits, persisted ----
  function persistLooks(next: SavedLook[]) {
    setSavedLooks(next);
    localStorage.setItem(LOOKS_KEY, JSON.stringify(next));
  }
  const lookItems = () => (equipped.length ? equipped : currentLook?.items ?? []);

  function saveLook() {
    const image = tryOnResult ?? mockPreview?.garment;
    const items = lookItems();
    if (!image || !items.length) { showToast("Render a look first"); return; }
    persistLooks([{ id: crypto.randomUUID(), image, items, createdAt: Date.now() }, ...savedLooks]);
    showToast("Saved to your lookbook");
  }
  function removeLook(id: string) { persistLooks(savedLooks.filter((l) => l.id !== id)); }
  function openCurrentLook() {
    const image = tryOnResult ?? mockPreview?.garment;
    if (!image) return;
    setDetailLook({ image, items: lookItems(), label: "Your Look" });
  }
  function cycleAvatar(dir: 1 | -1) {
    if (avatars.length < 2) return;
    const i = avatars.findIndex((a) => a.id === activeAvatarId);
    selectAvatar(avatars[(i + dir + avatars.length) % avatars.length]!.id);
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1A1A1A] antialiased">
      <TopBar cartCount={cart.length} onBagClick={() => setBagOpen(true)} savedCount={savedLooks.length} onLookbookClick={() => setLookbookOpen(true)} />
      <main className="mx-auto max-w-[1440px] px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <AvatarStage
            activeItem={activeItem}
            customPhoto={customPhoto}
            tryOnResult={tryOnResult}
            mockPreview={mockPreview}
            isLoading={isTryOnLoading}
            error={tryOnError}
            avatars={avatars}
            activeAvatarId={activeAvatarId}
            onSelectAvatar={selectAvatar}
            onRemoveAvatar={removeAvatar}
            onPhotoUpload={handlePhotoUpload}
            onTryOn={runTryOn}
            onPrevAvatar={() => cycleAvatar(-1)}
            onNextAvatar={() => cycleAvatar(1)}
            onSaveLook={saveLook}
            onOpenLook={openCurrentLook}
          />
          <WearingPanel
            equipped={equipped}
            currentLook={currentLook}
            isGenerating={isGenerating}
            generateError={generateError}
            onGenerate={generateOutfit}
            onRemove={removeEquipped}
            onAddToBag={addToBag}
            preferences={preferences}
            onPreferencesChange={updatePreferences}
            stylistSource={stylistSource}
          />
        </div>
        <WardrobeCatalog
          catalog={catalog}
          userItems={userItems}
          equipped={equipped}
          activeId={activeItem?.id ?? null}
          onToggle={toggleEquip}
          onAdd={(row) => setAddModal(row)}
          onRemoveUserItem={removeUserItem}
        />
      </main>
      <AddItemModal
        open={addModal !== null}
        category={addModal ?? "tops"}
        onClose={() => setAddModal(null)}
        onSave={addUserItem}
      />
      <BagDrawer
        open={bagOpen}
        items={cart}
        onClose={() => setBagOpen(false)}
        onRemove={removeFromBag}
        onClear={() => setCart([])}
      />
      <Lookbook
        open={lookbookOpen}
        looks={savedLooks}
        onClose={() => setLookbookOpen(false)}
        onOpen={(l) => { setLookbookOpen(false); setDetailLook({ image: l.image, items: l.items, label: "Saved Look" }); }}
        onRemove={removeLook}
      />
      {detailLook && <LookDetail look={detailLook} onClose={() => setDetailLook(null)} />}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-[#1A1A1A] px-4 py-3 text-sm text-white shadow-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C4A882]" />
          {toast}
        </div>
      )}
    </div>
  );
}

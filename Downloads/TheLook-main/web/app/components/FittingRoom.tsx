"use client";
import { useState } from "react";
import TopBar from "./TopBar";
import AvatarStage from "./AvatarStage";
import WearingPanel from "./WearingPanel";
import CatalogPanel from "./CatalogPanel";
import BagDrawer from "./BagDrawer";

type Item = {
  id: string; slot: string; title: string; color: string; palette: string;
  image: string; category?: string; layer?: string | null;
  formality?: number; fit?: string; color_role?: string;
};
type Look = { formula: string; items: Item[]; roles: string[]; score: number; cohesion: number; reason: string };

export default function FittingRoom({ catalog }: { catalog: Item[] }) {
  const [equipped, setEquipped] = useState<Item[]>([]);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [currentLook, setCurrentLook] = useState<Look | null>(null);

  const [selectedAvatar, setSelectedAvatar] = useState("a1");
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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const photo = reader.result as string;
      setCustomPhoto(photo);
      setTryOnResult(null);
      setMockPreview(null);
      if (activeItem) autoTryOn(photo, activeItem);
      else showToast("Photo uploaded — pick a garment to try on");
    };
    reader.readAsDataURL(file);
  }

  function toggleEquip(item: Item) {
    setActiveItem(item);
    setTryOnResult(null);
    setMockPreview(null);
    setEquipped((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) return prev.filter((i) => i.id !== item.id);
      return [...prev.filter((i) => i.slot !== item.slot), item];
    });
    if (customPhoto) autoTryOn(customPhoto, item);
  }

  function removeEquipped(item: Item) {
    setEquipped((prev) => prev.filter((i) => i.id !== item.id));
    if (activeItem?.id === item.id) setActiveItem(null);
  }

  // GET /api/recommend?anchors=a,b,c
  async function generateOutfit() {
    const anchorIds = equipped.length > 0
      ? equipped.map((i) => i.id)
      : activeItem ? [activeItem.id] : [catalog[0]?.id].filter(Boolean) as string[];

    if (anchorIds.length === 0) return;
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const params = new URLSearchParams({ anchors: anchorIds.join(",") });
      const res = await fetch(`/api/recommend?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      const looks: Look[] = data.looks ?? [];
      if (looks.length === 0) {
        setGenerateError("No outfits found. Try selecting a different item.");
        return;
      }
      const top = looks[0]!;
      setCurrentLook(top);
      setEquipped(top.items);
      setActiveItem(top.items[0] ?? null);
      showToast(`Outfit generated — ${(top.cohesion * 100).toFixed(0)}% cohesion`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setGenerateError(msg);
      showToast(`Generate failed: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  }

  // POST /api/tryon { photoBase64, garmentId }
  async function autoTryOn(photo: string, garment: Item) {
    setIsTryOnLoading(true);
    setTryOnError(null);
    setMockPreview(null);
    setTryOnResult(null);

    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoBase64: photo, garmentId: garment.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      if (data.mock) {
        setMockPreview({ photo, garment: data.resultUrl, title: garment.title });
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
    const garment = activeItem ?? equipped[0];
    if (!garment) { showToast("Pick a garment first"); return; }
    await autoTryOn(customPhoto ?? `/cutouts/${garment.id}.png`, garment);
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

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#1A1A1A] antialiased">
      <TopBar cartCount={cart.length} onBagClick={() => setBagOpen(true)} />
      <main className="mx-auto max-w-[1440px] px-6 py-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          <AvatarStage
            activeItem={activeItem}
            customPhoto={customPhoto}
            tryOnResult={tryOnResult}
            mockPreview={mockPreview}
            isLoading={isTryOnLoading}
            error={tryOnError}
            selectedAvatar={selectedAvatar}
            onAvatarChange={(id) => { setSelectedAvatar(id); setTryOnResult(null); setMockPreview(null); }}
            onPhotoUpload={handlePhotoUpload}
            onClearPhoto={() => { setCustomPhoto(null); setTryOnResult(null); setMockPreview(null); }}
            onTryOn={runTryOn}
          />
          <WearingPanel
            equipped={equipped}
            currentLook={currentLook}
            isGenerating={isGenerating}
            generateError={generateError}
            onGenerate={generateOutfit}
            onRemove={removeEquipped}
            onAddToBag={addToBag}
          />
        </div>
        <CatalogPanel
          catalog={catalog}
          equipped={equipped}
          activeId={activeItem?.id ?? null}
          onToggle={toggleEquip}
        />
      </main>
      <BagDrawer
        open={bagOpen}
        items={cart}
        onClose={() => setBagOpen(false)}
        onRemove={removeFromBag}
        onClear={() => setCart([])}
      />
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-[#1A1A1A] px-4 py-3 text-sm text-white shadow-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C4A882]" />
          {toast}
        </div>
      )}
    </div>
  );
}

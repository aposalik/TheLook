"use client";
import { useCallback, useEffect, useState } from "react";
import TopBar from "./TopBar";
import AvatarStage from "./AvatarStage";
import WearingPanel from "./WearingPanel";
import WardrobeCatalog from "./WardrobeCatalog";
import AddItemModal, { type RowKey } from "./AddItemModal";
import ChatDrawer from "./chat/ChatDrawer";
import BagDrawer from "./BagDrawer";
import Lookbook, { type SavedLook } from "./Lookbook";
import LookDetail, { type DetailLook } from "./LookDetail";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useAuth } from "./auth/AuthProvider";
import AuthDialog from "./auth/AuthDialog";
import { createClient } from "@/lib/supabase/client";
import { signedUrl } from "@/lib/storage";

import AvatarUploadModal from "./AvatarUploadModal";

import type { Item, Look, StylePreferences } from "@/lib/recommend";
type Avatar = { id: string; url: string; storagePath?: string; isCutout?: boolean };
const AV_KEY = "thelook_avatars";
const LOOKS_KEY = "thelook_looks";
const WARDROBE_KEY = "thelook_wardrobe";
const PREFS_KEY = "thelook_style_preferences";

function userKey(base: string, userId: string) {
  return `${base}:${userId}`;
}

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
  const sounds = useSoundEffects();
  const { user, isGuest, isVerifiedAccount } = useAuth();
  const [equipped, setEquipped] = useState<Item[]>([]);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [currentLook, setCurrentLook] = useState<Look | null>(null);
  const [recommendedLooks, setRecommendedLooks] = useState<Look[]>([]);

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
  const [avatarUploadOpen, setAvatarUploadOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Load all user data from DB on mount / identity change.
  // localStorage is used as an optimistic cache only.
  const loadFromDb = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();

    // Avatars — fetch DB rows, generate signed URLs for display
    try {
      const { data: avRows } = await supabase
        .from("avatars")
        .select("id, storage_path")
        .order("created_at", { ascending: true });
      if (avRows && avRows.length > 0) {
        const loaded: Avatar[] = await Promise.all(
          avRows.map(async (row: { id: string; storage_path: string }) => {
            // Signed URL must be fetched server-side; use the API route.
            const res = await fetch(`/api/avatar/${row.id}/url`);
            const d = await res.json() as { signedUrl?: string };
            return { id: row.id, storagePath: row.storage_path, url: d.signedUrl ?? "" };
          }),
        );
        setAvatars(loaded);
        setActiveAvatarId(loaded[0]?.id ?? null);
        setCustomPhoto(loaded[0]?.url ?? null);
        localStorage.setItem(userKey(AV_KEY, user.id), JSON.stringify(loaded));
      } else {
        // Fall back to localStorage (guest or first visit)
        const cached = JSON.parse(localStorage.getItem(userKey(AV_KEY, user.id)) ?? "[]") as Avatar[];
        setAvatars(cached);
        setActiveAvatarId(cached[0]?.id ?? null);
        setCustomPhoto(cached[0]?.url ?? null);
      }
    } catch {
      const cached = JSON.parse(localStorage.getItem(userKey(AV_KEY, user.id)) ?? "[]") as Avatar[];
      setAvatars(cached);
      setActiveAvatarId(cached[0]?.id ?? null);
      setCustomPhoto(cached[0]?.url ?? null);
    }

    // Wardrobe items — DB rows carry metadata; image served from Storage via signed URL
    try {
      const { data: wRows } = await supabase
        .from("wardrobe_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (wRows && wRows.length > 0) {
        const items: Item[] = await Promise.all(
          wRows.map(async (row: Record<string, unknown>) => {
            const res = await fetch(`/api/wardrobe/${row.id}/url`);
            const d = await res.json() as { signedUrl?: string };
            return {
              id: row.id as string,
              slot: (row.category as string) === "bottom" ? "bottom"
                : (row.category as string) === "shoe" ? "shoe"
                : (row.category as string) === "accessory" ? "accessory"
                : (row.category as string) === "dress" ? "dress"
                : (row.layer as string) === "outer" ? "outerwear" : "top",
              title: row.title as string,
              color: (row.dominant_color as string) ?? "#8A8480",
              palette: (row.palette as string) ?? "neutral",
              image: d.signedUrl ?? "",
              category: row.category as string,
              layer: row.layer as string | null,
              formality: (row.formality as number) ?? 2,
              fit: (row.fit as string) ?? "regular",
              color_role: (row.color_role as string) ?? "neutral",
              subcategory: row.subcategory as string | undefined,
              seasons: (row.seasons as string[]) ?? [],
              styles: (row.styles as string[]) ?? [],
              material: row.material as string | undefined,
              description: row.description as string | undefined,
              source: "user" as const,
            };
          }),
        );
        setUserItems(items);
        localStorage.setItem(userKey(WARDROBE_KEY, user.id), JSON.stringify(items));
      } else {
        const cached = JSON.parse(localStorage.getItem(userKey(WARDROBE_KEY, user.id)) ?? "[]") as Item[];
        setUserItems(cached);
      }
    } catch {
      const cached = JSON.parse(localStorage.getItem(userKey(WARDROBE_KEY, user.id)) ?? "[]") as Item[];
      setUserItems(cached);
    }

    // Preferences
    try {
      const { data: prefRow } = await supabase
        .from("user_preferences")
        .select("occasion, styling_goal")
        .single();
      if (prefRow) {
        const prefs: StylePreferences = { occasion: prefRow.occasion, goal: prefRow.styling_goal };
        setPreferences(prefs);
        localStorage.setItem(userKey(PREFS_KEY, user.id), JSON.stringify(prefs));
      } else {
        const cached = JSON.parse(localStorage.getItem(userKey(PREFS_KEY, user.id)) ?? '{"occasion":"any","goal":"balanced"}') as StylePreferences;
        setPreferences(cached);
      }
    } catch {
      const cached = JSON.parse(localStorage.getItem(userKey(PREFS_KEY, user.id)) ?? '{"occasion":"any","goal":"balanced"}') as StylePreferences;
      setPreferences(cached);
    }

    // Saved looks
    try {
      const { data: lookRows } = await supabase
        .from("saved_looks")
        .select("id, render_path, formula, stylist_title, cohesion, created_at")
        .order("created_at", { ascending: false });
      if (lookRows && lookRows.length > 0) {
        const looks: SavedLook[] = await Promise.all(
          lookRows.map(async (row: Record<string, unknown>) => {
            let image = "";
            if (row.render_path) {
              const res = await fetch(`/api/renders/${encodeURIComponent(row.render_path as string)}/url`);
              const d = await res.json() as { signedUrl?: string };
              image = d.signedUrl ?? "";
            }
            return {
              id: row.id as string,
              image,
              items: [],
              createdAt: new Date(row.created_at as string).getTime(),
            };
          }),
        );
        setSavedLooks(looks);
        localStorage.setItem(userKey(LOOKS_KEY, user.id), JSON.stringify(looks));
      } else {
        const cached = JSON.parse(localStorage.getItem(userKey(LOOKS_KEY, user.id)) ?? "[]") as SavedLook[];
        setSavedLooks(cached);
      }
    } catch {
      const cached = JSON.parse(localStorage.getItem(userKey(LOOKS_KEY, user.id)) ?? "[]") as SavedLook[];
      setSavedLooks(cached);
    }

    // Reset transient UI state on identity change
    setTryOnResult(null);
    setMockPreview(null);
    setEquipped([]);
    setActiveItem(null);
    setCurrentLook(null);
    setRecommendedLooks([]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Supabase + localStorage are external stores; hydrate from them on identity change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFromDb();
  }, [user, loadFromDb]);

  function persistUserItems(next: Item[]) {
    if (!user) return;
    setUserItems(next);
    localStorage.setItem(userKey(WARDROBE_KEY, user.id), JSON.stringify(next));
  }

  function addUserItem(item: Item) {
    persistUserItems([item, ...userItems]);
    showToast(`Added "${item.title}" to your wardrobe`);
  }

  function removeUserItem(id: string) {
    persistUserItems(userItems.filter((i) => i.id !== id));
    setEquipped((prev) => prev.filter((i) => i.id !== id));
    if (activeItem?.id === id) setActiveItem(null);
    // Delete from DB + Storage in background
    fetch(`/api/wardrobe/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function persistAvatars(next: Avatar[]) {
    if (!user) return;
    setAvatars(next);
    localStorage.setItem(userKey(AV_KEY, user.id), JSON.stringify(next));
  }

  async function handleSaveAvatarFromModal(url: string, isCutout: boolean) {
    const av: Avatar = { id: crypto.randomUUID(), url, isCutout };
    const next = [...avatars, av];
    persistAvatars(next);
    setActiveAvatarId(av.id);
    setCustomPhoto(url);
    setTryOnResult(null);
    setMockPreview(null);
    showToast(isCutout ? "Cutout avatar saved" : "Photo avatar saved");

    // Upload to private Storage in background; patch storagePath onto saved avatar
    fetch("/api/avatar/upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageBase64: url, avatarId: av.id, isCutout }),
    }).then((r) => r.json()).then((d: { storagePath?: string; error?: string }) => {
      if (d.error) { showToast(`Avatar upload: ${d.error}`); return; }
      if (d.storagePath) {
        setAvatars((prev) => {
          const updated = prev.map((a) => a.id === av.id ? { ...a, storagePath: d.storagePath, isCutout } : a);
          if (user) localStorage.setItem(userKey(AV_KEY, user.id), JSON.stringify(updated));
          return updated;
        });
      }
    }).catch((e: unknown) => showToast(`Avatar upload failed: ${e instanceof Error ? e.message : String(e)}`));
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
    // Delete from DB + Storage in background
    fetch(`/api/avatar/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function toggleEquip(item: Item) {
    sounds.selectWardrobeItem();
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
    if (!user) return;
    setPreferences(next);
    localStorage.setItem(userKey(PREFS_KEY, user.id), JSON.stringify(next));
    // Persist to DB in background
    fetch("/api/preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    }).catch(() => {});
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
      setRecommendedLooks(looks.slice(0, 3));
      setCurrentLook(top);
      setEquipped(top.items);
      setActiveItem(top.items[0] ?? null);
      showToast(`${styled.source === "gemini" ? "Gemini stylist" : "Outfit engine"} ranked ${Math.min(3, looks.length)} looks · ${(top.cohesion * 100).toFixed(0)}% top cohesion`);
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
  function chooseRecommendedLook(look: Look) {
    sounds.selectWardrobeItem();
    setCurrentLook(look);
    setEquipped(look.items);
    setActiveItem(look.items[0] ?? null);
    setTryOnResult(null);
    setMockPreview(null);
    showToast(`${look.stylistTitle ?? look.formula} selected`);
  }

  // Style Assistant picked a complete outfit: replace the tray with it. Rendering
  // stays manual — the user presses Show On Me (no automatic credit spend).
  function onChatEquip(items: Item[]) {
    if (!items.length) return;
    sounds.selectWardrobeItem();
    setCurrentLook(null);
    setEquipped(items);
    setActiveItem(items[0] ?? null);
    setTryOnResult(null);
    setMockPreview(null);
    showToast(`Equipped ${items.length} piece${items.length === 1 ? "" : "s"} from the Style Assistant`);
  }

  async function renderLook(photo: string, items: Item[]) {
    sounds.beginTryOn();
    setIsTryOnLoading(true);
    setTryOnError(null);
    setMockPreview(null);
    setTryOnResult(null);

    try {
      // Strip the image blob from catalog items (route reads them from disk).
      // Keep image only for user-uploaded items (source === "user") so the
      // server can render them without a file on disk.
      const itemsPayload = items.map((i) => (
        i.source === "user" ? i : { ...i, image: undefined }
      ));
      const res = await fetch("/api/tryon-look", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoBase64: photo, itemIds: items.map((i) => i.id), items: itemsPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      if (data.mock) {
        setMockPreview({ photo, garment: data.resultUrl, title: "your look" });
      } else {
        setTryOnResult(data.resultUrl);
      }
      sounds.finishTryOn(true);
      showToast(data.mock ? "Mock preview ready" : "Try-on render complete!");
    } catch (e) {
      sounds.finishTryOn(false);
      const msg = e instanceof Error ? e.message : String(e);
      setTryOnError(msg);
      showToast(`Try-on failed: ${msg}`);
    } finally {
      setIsTryOnLoading(false);
    }
  }

  async function runTryOn() {
    if (!isVerifiedAccount) {
      showToast("Sign in with a verified account to use Show on me");
      setAccountOpen(true);
      return;
    }
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
    if (!user) return;
    setSavedLooks(next);
    localStorage.setItem(userKey(LOOKS_KEY, user.id), JSON.stringify(next));
  }
  const lookItems = () => (equipped.length ? equipped : currentLook?.items ?? []);

  function saveLook() {
    const image = tryOnResult ?? mockPreview?.garment;
    const items = lookItems();
    if (!image || !items.length) { showToast("Render a look first"); return; }
    const look: SavedLook = { id: crypto.randomUUID(), image, items, createdAt: Date.now() };
    persistLooks([look, ...savedLooks]);
    showToast("Saved to your lookbook");
    // Persist to DB in background
    fetch("/api/looks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: look.id,
        renderPath: null, // render_path stored in DB by tryon-look route in Phase E
        formula: currentLook?.formula ?? "custom",
        stylistTitle: currentLook?.stylistTitle,
        cohesion: currentLook?.cohesion,
        reason: currentLook?.aiReason,
        items,
      }),
    }).catch(() => {});
  }
  function removeLook(id: string) {
    persistLooks(savedLooks.filter((l) => l.id !== id));
    fetch(`/api/looks/${id}`, { method: "DELETE" }).catch(() => {});
  }
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
      <TopBar
        cartCount={cart.length}
        onBagClick={() => setBagOpen(true)}
        savedCount={savedLooks.length}
        onLookbookClick={() => setLookbookOpen(true)}
        soundEnabled={sounds.enabled}
        onSoundToggle={sounds.toggle}
        accountLabel={isVerifiedAccount ? (user?.email ?? "Account") : "Guest wardrobe"}
        isGuest={isGuest}
        onAccountClick={() => setAccountOpen(true)}
      />
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
            onOpenUploadModal={() => setAvatarUploadOpen(true)}
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
            recommendedLooks={recommendedLooks}
            onSelectLook={chooseRecommendedLook}
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
      <AvatarUploadModal
        open={avatarUploadOpen}
        onClose={() => setAvatarUploadOpen(false)}
        onSaveAvatar={handleSaveAvatarFromModal}
      />
      <ChatDrawer userItems={userItems} onEquip={onChatEquip} />
      {accountOpen && <AuthDialog open onClose={() => setAccountOpen(false)} />}
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

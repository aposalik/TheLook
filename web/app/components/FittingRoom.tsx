"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { normalizeOutfitFeedback, type OutfitFeedbackEvent, type OutfitFeedbackSignal } from "@/lib/outfit-feedback";

import AvatarUploadModal from "./AvatarUploadModal";

import {
  inferLegacyGarmentSemantics,
  inferSmartUpperSlots,
  isSubstantialLayerPiece,
  normalizeGarmentSemantics,
  type Item,
  type Look,
  type StylePreferences,
} from "@/lib/recommend";
type Avatar = { id: string; url: string; storagePath?: string; isCutout?: boolean };
const AV_KEY = "thelook_avatars";
const LOOKS_KEY = "thelook_looks";
const WARDROBE_KEY = "thelook_wardrobe";
const PREFS_KEY = "thelook_style_preferences";
const RECOMMENDED_KEY = "thelook_recommended_looks_v2";
const CURRENT_LOOK_KEY = "thelook_current_look_v2";
const EQUIPPED_KEY = "thelook_equipped_v2";
const ACTIVE_AV_KEY = "thelook_active_avatar_id";
const FEEDBACK_KEY = "thelook_outfit_feedback";
const LOCKS_KEY = "thelook_locked_items";

function userKey(base: string, userId: string) {
  return `${base}:${userId}`;
}

/** Strip large base64 image data before writing looks/items to localStorage to prevent quota errors */
function stripItemImages(item: Item): Item {
  return item.image?.startsWith("data:image/") ? { ...item, image: "" } : item;
}

function stripLookImages(look: Look): Look {
  return { ...look, items: look.items.map(stripItemImages) };
}

function hydrateItemImage(item: Item, byId: Map<string, Item>): Item {
  if (item.image) return item;
  const existing = byId.get(item.id);
  return existing?.image ? { ...item, image: existing.image } : item;
}

/** Safe localStorage write that catches QuotaExceededError silently without crashing */
function safeSetStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota reached or storage disabled: non-fatal, session remains in memory
  }
}

export default function FittingRoom({ catalog }: { catalog: Item[] }) {
  const sounds = useSoundEffects();
  const { user, isGuest, isVerifiedAccount } = useAuth();
  const prevUserIdRef = useRef<string | null>(null);
  const [equipped, setEquipped] = useState<Item[]>([]);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [currentLook, setCurrentLook] = useState<Look | null>(null);
  const [recommendedLooks, setRecommendedLooks] = useState<Look[]>([]);
  const [outfitFeedback, setOutfitFeedback] = useState<OutfitFeedbackEvent[]>([]);
  const [lockedItemIds, setLockedItemIds] = useState<string[]>([]);

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [activeAvatarId, setActiveAvatarId] = useState<string | null>(null);
  const [customPhoto, setCustomPhoto] = useState<string | null>(null);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [tryOnRenderPath, setTryOnRenderPath] = useState<string | null>(null);
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
  const [stylistWarning, setStylistWarning] = useState<string | null>(null);
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
    const hydrationItems = new Map<string, Item>(catalog.map((item) => [item.id, item]));

    // Avatars — fetch DB rows, generate signed URLs for display
    try {
      const { data: avRows } = await supabase
        .from("avatars")
        .select("id, storage_path")
        .order("created_at", { ascending: true });

      const cached = JSON.parse(localStorage.getItem(userKey(AV_KEY, user.id)) ?? "[]") as Avatar[];
      const cachedMap = new Map(cached.map((c) => [c.id, c]));
      const savedActiveId = localStorage.getItem(userKey(ACTIVE_AV_KEY, user.id));

      if (avRows && avRows.length > 0) {
        const loaded: Avatar[] = await Promise.all(
          avRows.map(async (row: { id: string; storage_path: string }) => {
            // Signed URL must be fetched server-side; use the API route.
            const res = await fetch(`/api/avatar/${row.id}/url`);
            const d = await res.json() as { signedUrl?: string };
            const existing = cachedMap.get(row.id);
            return {
              id: row.id,
              storagePath: row.storage_path,
              url: existing?.url?.startsWith("data:") ? existing.url : (d.signedUrl ?? existing?.url ?? ""),
              isCutout: existing?.isCutout ?? false,
            };
          }),
        );
        setAvatars(loaded);
        const chosen = (savedActiveId && loaded.find((a) => a.id === savedActiveId))
          || loaded[0]
          || null;
        setActiveAvatarId(chosen?.id ?? null);
        setCustomPhoto(chosen?.url ?? null);
        localStorage.setItem(userKey(AV_KEY, user.id), JSON.stringify(loaded));
      } else {
        // Fall back to localStorage (guest or first visit)
        setAvatars(cached);
        const chosen = (savedActiveId && cached.find((a) => a.id === savedActiveId))
          || cached[0]
          || null;
        setActiveAvatarId(chosen?.id ?? null);
        setCustomPhoto(chosen?.url ?? null);
      }
    } catch {
      const cached = JSON.parse(localStorage.getItem(userKey(AV_KEY, user.id)) ?? "[]") as Avatar[];
      const savedActiveId = localStorage.getItem(userKey(ACTIVE_AV_KEY, user.id));
      setAvatars(cached);
      const chosen = (savedActiveId && cached.find((a) => a.id === savedActiveId))
        || cached[0]
        || null;
      setActiveAvatarId(chosen?.id ?? null);
      setCustomPhoto(chosen?.url ?? null);
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
            const rawStyles = (row.styles as string[]) ?? [];
            const storedSlots = rawStyles
              .filter((s) => s.startsWith("slot:"))
              .map((s) => s.slice(5));
            const cleanStyles = rawStyles.filter((s) => !s.startsWith("slot:"));
            const defaultSlot =
              (row.category as string) === "bottom" ? "bottom"
              : (row.category as string) === "shoe" ? "shoe"
              : (row.category as string) === "accessory" ? "accessory"
              : (row.category as string) === "dress" ? "dress"
              : (row.layer as string) === "outer" ? "outerwear" : "top";
            let slots = storedSlots.length > 0 ? storedSlots : [defaultSlot];
            let layer = row.layer as string | null;

            const candidateItem: Item = {
              id: row.id as string,
              slot: slots[0] ?? defaultSlot,
              slots,
              title: row.title as string,
              color: (row.dominant_color as string) ?? "#8A8480",
              palette: (row.palette as string) ?? "neutral",
              image: d.signedUrl ?? "",
              category: row.category as string,
              layer,
              formality: (row.formality as number) ?? 2,
              fit: (row.fit as string) ?? "regular",
              color_role: (row.color_role as string) ?? "neutral",
              subcategory: row.subcategory as string | undefined,
              seasons: (row.seasons as string[]) ?? [],
              styles: cleanStyles,
              material: row.material as string | undefined,
              description: row.description as string | undefined,
              source: "user" as const,
              semantics: normalizeGarmentSemantics(row.semantics),
            };
            const hadStoredSemantics = Object.keys(candidateItem.semantics ?? {}).length > 0;
            if (!hadStoredSemantics) candidateItem.semantics = inferLegacyGarmentSemantics(candidateItem);

            // Auto-repair legacy shirts/sweaters that were over-broadly tagged as mid-layer outerwear
            if (
              candidateItem.category === "upper" &&
              layer === "mid" &&
              !isSubstantialLayerPiece(candidateItem)
            ) {
              layer = "base";
              slots = slots.filter((s) => s !== "outerwear");
              if (!slots.length) slots = ["top"];
              candidateItem.layer = layer;
              candidateItem.slots = slots;
              candidateItem.slot = slots[0]!;
            }

            // If an existing upper item in DB never had explicit slot:* tags, infer smart roles
            // (e.g. ["innerwear", "top"] for tees, ["top", "outerwear"] for camp collar / half-zip / overshirts)
            if (storedSlots.length === 0 && candidateItem.category === "upper") {
              const inferred = inferSmartUpperSlots(candidateItem);
              if (inferred.length > 0) {
                slots = inferred;
                candidateItem.slots = slots;
                candidateItem.slot = slots[0]!;
                if (slots.includes("outerwear") && slots.includes("top")) {
                  candidateItem.layer = "mid";
                } else if (slots.includes("outerwear") && !slots.includes("top")) {
                  candidateItem.layer = "outer";
                } else {
                  candidateItem.layer = "base";
                }
              }
            }

            if (storedSlots.length === 0 || !hadStoredSemantics) {
              void supabase
                .from("wardrobe_items")
                .update({
                  layer: candidateItem.layer ?? null,
                  styles: [...cleanStyles, ...slots.map((s) => `slot:${s}`)],
                  semantics: candidateItem.semantics ?? {},
                })
                .eq("id", candidateItem.id);
            }

            return candidateItem;
          }),
        );
        const dbIds = new Set(items.map((i) => i.id));
        const cached = JSON.parse(localStorage.getItem(userKey(WARDROBE_KEY, user.id)) ?? "[]") as Item[];
        const merged = [...items, ...cached.filter((c) => !dbIds.has(c.id))];
        for (const item of merged) hydrationItems.set(item.id, item);
        setUserItems(merged);
        safeSetStorage(userKey(WARDROBE_KEY, user.id), JSON.stringify(merged));
      } else {
        const cached = JSON.parse(localStorage.getItem(userKey(WARDROBE_KEY, user.id)) ?? "[]") as Item[];
        for (const item of cached) hydrationItems.set(item.id, item);
        setUserItems((prev) => (prev.length > 0 && cached.length === 0 ? prev : cached));
      }
    } catch {
      const cached = JSON.parse(localStorage.getItem(userKey(WARDROBE_KEY, user.id)) ?? "[]") as Item[];
      for (const item of cached) hydrationItems.set(item.id, item);
      setUserItems((prev) => (prev.length > 0 && cached.length === 0 ? prev : cached));
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

    // Outfit feedback — server is canonical, localStorage remains an offline fallback.
    const cachedFeedback = normalizeOutfitFeedback(JSON.parse(localStorage.getItem(userKey(FEEDBACK_KEY, user.id)) ?? "[]"));
    try {
      const feedbackResponse = await fetch("/api/feedback");
      if (feedbackResponse.ok) {
        const body = await feedbackResponse.json() as { feedback?: OutfitFeedbackEvent[] };
        const feedback = normalizeOutfitFeedback(body.feedback);
        setOutfitFeedback(feedback);
        safeSetStorage(userKey(FEEDBACK_KEY, user.id), JSON.stringify(feedback));
      } else {
        setOutfitFeedback(cachedFeedback);
      }
    } catch {
      setOutfitFeedback(cachedFeedback);
    }
    const cachedLocks = JSON.parse(localStorage.getItem(userKey(LOCKS_KEY, user.id)) ?? "[]") as unknown;
    setLockedItemIds(Array.isArray(cachedLocks) ? cachedLocks.filter((id): id is string => typeof id === "string") : []);

    // Saved looks
    try {
      const res = await fetch("/api/looks");
      if (res.ok) {
        const { looks } = await res.json() as { looks: SavedLook[] };
        if (Array.isArray(looks) && looks.length > 0) {
          const hydratedLooks = looks.map((l) => ({
            ...l,
            items: (l.items ?? []).map((entry) => hydrateItemImage(entry, hydrationItems)),
          }));
          setSavedLooks(hydratedLooks);
          safeSetStorage(userKey(LOOKS_KEY, user.id), JSON.stringify(hydratedLooks));
        } else {
          setSavedLooks([]);
          safeSetStorage(userKey(LOOKS_KEY, user.id), "[]");
        }
      } else {
        const cached = JSON.parse(localStorage.getItem(userKey(LOOKS_KEY, user.id)) ?? "[]") as SavedLook[];
        setSavedLooks(cached);
      }
    } catch {
      const cached = JSON.parse(localStorage.getItem(userKey(LOOKS_KEY, user.id)) ?? "[]") as SavedLook[];
      setSavedLooks(cached);
    }

    // Check if this is an actual user account switch
    const isActualUserSwitch = prevUserIdRef.current !== null && prevUserIdRef.current !== user.id;
    prevUserIdRef.current = user.id;

    if (isActualUserSwitch) {
      // Reset transient UI state on identity change
      setTryOnResult(null);
      setTryOnRenderPath(null);
      setMockPreview(null);
      setEquipped([]);
      setActiveItem(null);
      setCurrentLook(null);
      setRecommendedLooks([]);
      setLockedItemIds([]);
    } else {
      // Restore suggestions, current look, and equipped outfit across tab switches and reloads
      try {
        const byId = hydrationItems;
        const savedRecs = JSON.parse(localStorage.getItem(userKey(RECOMMENDED_KEY, user.id)) ?? "[]") as Look[];
        if (savedRecs.length > 0) {
          setRecommendedLooks(savedRecs.map((l) => ({
            ...l,
            items: l.items.map((i) => hydrateItemImage(i, byId)),
          })));
        }
        const savedLook = JSON.parse(localStorage.getItem(userKey(CURRENT_LOOK_KEY, user.id)) ?? "null") as Look | null;
        if (savedLook) {
          setCurrentLook({
            ...savedLook,
            items: savedLook.items.map((i) => hydrateItemImage(i, byId)),
          });
        }
        const savedEquipped = JSON.parse(localStorage.getItem(userKey(EQUIPPED_KEY, user.id)) ?? "[]") as Item[];
        if (savedEquipped.length > 0) {
          const hydrated = savedEquipped.map((i) => hydrateItemImage(i, byId));
          setEquipped(hydrated);
          setActiveItem(hydrated[0] ?? null);
        }
      } catch {
        // ignore
      }
    }
  }, [user, catalog]);

  useEffect(() => {
    if (!user) return;
    // Supabase + localStorage are external stores; hydrate from them on identity change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFromDb();
  }, [user, loadFromDb]);

  function persistUserItems(next: Item[]) {
    if (!user) return;
    setUserItems(next);
    safeSetStorage(userKey(WARDROBE_KEY, user.id), JSON.stringify(next));
  }

  function addUserItem(itemOrItems: Item | Item[]) {
    const incoming = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    if (!incoming.length) return;

    setUserItems((prev) => {
      const next = [...incoming, ...prev];
      if (user) {
        safeSetStorage(userKey(WARDROBE_KEY, user.id), JSON.stringify(next));
      }
      return next;
    });

    if (incoming.length === 1) {
      showToast(`Added "${incoming[0]!.title}" to your wardrobe`);
    } else {
      showToast(`Added ${incoming.length} pieces to your wardrobe`);
    }

    // Persist each item to Supabase Storage + wardrobe_items table
    if (user && !isGuest) {
      const uid = user.id;
      void (async () => {
        let failed = 0;
        for (const item of incoming) {
          if (!item.image || !item.image.startsWith("data:")) continue;
          try {
            const res = await fetch("/api/wardrobe/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageBase64: item.image,
                itemId: item.id,
                item,
              }),
            });
            if (!res.ok) {
              failed++;
              continue;
            }
            const data = await res.json() as { signedUrl?: string; itemId?: string };
            if (data.signedUrl) {
              setUserItems((prev) => {
                const updated = prev.map((existing) =>
                  existing.id === item.id
                    ? { ...existing, id: data.itemId ?? existing.id, image: data.signedUrl! }
                    : existing,
                );
                safeSetStorage(userKey(WARDROBE_KEY, uid), JSON.stringify(updated));
                return updated;
              });
            }
          } catch {
            failed++;
          }
        }
        if (failed > 0) {
          showToast(`Warning: ${failed} item(s) could not be synced to cloud storage`);
        }
      })();
    }
  }

  function removeUserItem(id: string) {
    setUserItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (user) {
        safeSetStorage(userKey(WARDROBE_KEY, user.id), JSON.stringify(next));
      }
      return next;
    });
    setEquipped((prev) => prev.filter((i) => i.id !== id));
    if (activeItem?.id === id) setActiveItem(null);
    // Delete from DB + Storage in background
    fetch(`/api/wardrobe/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function updateUserItemSlots(id: string, nextSlots: string[]) {
    if (!nextSlots.length) return;
    const primary = nextSlots[0]!;
    const hasOuter = nextSlots.includes("outerwear");
    const hasTop = nextSlots.includes("top");
    const hasInner = nextSlots.includes("innerwear");
    const hasUpper = hasOuter || hasTop || hasInner;
    const category = hasUpper
      ? "upper"
      : primary === "bottom" || primary === "dress" || primary === "shoe" || primary === "accessory"
        ? primary
        : "upper";
    const layer = hasUpper
      ? (hasOuter && (hasTop || hasInner) ? "mid" : hasOuter ? "outer" : "base")
      : null;

    let updatedItemStyles: string[] = [];
    setUserItems((prev) => {
      const next = prev.map((it) => {
        if (it.id !== id) return it;
        updatedItemStyles = it.styles ?? [];
        return {
          ...it,
          slot: primary,
          slots: nextSlots,
          category,
          layer,
        };
      });
      if (user) {
        safeSetStorage(userKey(WARDROBE_KEY, user.id), JSON.stringify(next));
      }
      return next;
    });

    setEquipped((prev) =>
      prev.map((it) => (it.id === id ? { ...it, slot: primary, slots: nextSlots, category, layer } : it)),
    );

    showToast(`Updated roles: ${nextSlots.join(" · ")}`);
    fetch(`/api/wardrobe/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: nextSlots, category, layer, styles: updatedItemStyles }),
    }).catch(() => {});
  }

  function persistAvatars(next: Avatar[]) {
    if (!user) return;
    setAvatars(next);
    safeSetStorage(userKey(AV_KEY, user.id), JSON.stringify(next));
  }

  async function handleSaveAvatarFromModal(url: string, isCutout: boolean) {
    const av: Avatar = { id: crypto.randomUUID(), url, isCutout };
    const next = [...avatars, av];
    persistAvatars(next);
    setActiveAvatarId(av.id);
    setCustomPhoto(url);
    if (user) {
      safeSetStorage(userKey(ACTIVE_AV_KEY, user.id), av.id);
    }
    setTryOnResult(null);
    setTryOnRenderPath(null);
    setMockPreview(null);
    showToast(isCutout ? "Cutout avatar saved" : "Photo avatar saved");

    if (!isGuest) {
      // Upload permanent-account avatars to private Storage in the background.
      fetch("/api/avatar/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: url, avatarId: av.id, isCutout }),
      }).then((r) => r.json()).then((d: { storagePath?: string; signedUrl?: string; error?: string }) => {
        if (d.error) { showToast(`Avatar upload: ${d.error}`); return; }
        if (d.storagePath) {
          setAvatars((prev) => {
            const updated = prev.map((a) => a.id === av.id ? { ...a, storagePath: d.storagePath, isCutout } : a);
            if (user) safeSetStorage(userKey(AV_KEY, user.id), JSON.stringify(updated));
            return updated;
          });
        }
      }).catch((e: unknown) => showToast(`Avatar upload failed: ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  function selectAvatar(id: string) {
    const av = avatars.find((a) => a.id === id);
    if (!av) return;
    setActiveAvatarId(id);
    setCustomPhoto(av.url);
    setTryOnResult(null);
    setTryOnRenderPath(null);
    setMockPreview(null);
    if (user) {
      safeSetStorage(userKey(ACTIVE_AV_KEY, user.id), id);
    }
    showToast(`Switched to Avatar ${avatars.findIndex((a) => a.id === id) + 1}`);
  }

  async function removeAvatar(id: string) {
    const next = avatars.filter((a) => a.id !== id);
    persistAvatars(next);
    if (activeAvatarId === id) {
      const first = next[0] ?? null;
      setActiveAvatarId(first?.id ?? null);
      setCustomPhoto(first?.url ?? null);
      setTryOnResult(null);
      setTryOnRenderPath(null);
      setMockPreview(null);
      if (user) {
        safeSetStorage(userKey(ACTIVE_AV_KEY, user.id), first?.id ?? "");
      }
    }
    showToast("Deleting avatar from cloud storage…");
    try {
      const res = await fetch(`/api/avatar/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      showToast("Avatar deleted from storage");
    } catch (err) {
      showToast(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function toggleEquip(item: Item) {
    sounds.selectWardrobeItem();
    setActiveItem(item);
    setTryOnResult(null);
    setTryOnRenderPath(null);
    setMockPreview(null);
    setEquipped((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) {
        const next = prev.filter((i) => i.id !== item.id);
        if (user) safeSetStorage(userKey(EQUIPPED_KEY, user.id), JSON.stringify(next.map(stripItemImages)));
        return next;
      }
      // Allow a real layered outfit: one base (innerwear), one mid (top) and one outer (outerwear).
      // Bottoms, shoes and dresses remain mutually exclusive; accessories can stack.
      const isUpper = (value: Item) =>
        value.category === "upper" ||
        value.slot === "innerwear" ||
        value.slot === "top" ||
        value.slot === "outerwear" ||
        value.slots?.some((s) => s === "innerwear" || s === "top" || s === "outerwear");

      const upperRoleFor = (value: Item): "base" | "mid" | "outer" => {
        if (value.slot === "innerwear") return "base";
        if (value.slot === "outerwear" || value.layer === "outer") return "outer";
        if (value.layer === "mid") return "mid";
        return "base";
      };

      const key = (value: Item) => {
        const category = value.category ?? value.slot;
        if (isUpper(value)) return `upper:${upperRoleFor(value)}`;
        if (category === "accessory") return `accessory:${value.id}`;
        return category;
      };
      const next = [...prev.filter((existing) => key(existing) !== key(item)), item];
      if (user) safeSetStorage(userKey(EQUIPPED_KEY, user.id), JSON.stringify(next.map(stripItemImages)));
      return next;
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
    setEquipped((prev) => {
      const next = prev.filter((i) => i.id !== item.id);
      if (user) safeSetStorage(userKey(EQUIPPED_KEY, user.id), JSON.stringify(next.map(stripItemImages)));
      return next;
    });
    if (activeItem?.id === item.id) setActiveItem(null);
  }

  function toggleItemLock(itemId: string) {
    setLockedItemIds((previous) => {
      const next = previous.includes(itemId) ? previous.filter((id) => id !== itemId) : [...previous, itemId];
      if (user) safeSetStorage(userKey(LOCKS_KEY, user.id), JSON.stringify(next));
      return next;
    });
  }

  function feedbackForLook(look: Look | null): OutfitFeedbackSignal | null {
    if (!look) return null;
    const signature = look.items.map((item) => item.id).sort().join("|");
    const event = [...outfitFeedback].reverse().find((entry) => [...entry.itemIds].sort().join("|") === signature);
    return event?.signal ?? null;
  }

  function submitLookFeedback(signal: OutfitFeedbackSignal) {
    if (!currentLook || !user) return;
    const event: OutfitFeedbackEvent = {
      id: crypto.randomUUID(),
      itemIds: currentLook.items.map((item) => item.id),
      signal,
      createdAt: Date.now(),
    };
    const next = normalizeOutfitFeedback([...outfitFeedback, event]);
    setOutfitFeedback(next);
    safeSetStorage(userKey(FEEDBACK_KEY, user.id), JSON.stringify(next));
    void fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    showToast(signal === "like" ? "Saved — recommendations will learn from this look" : "Noted — similar combinations will rank lower");
  }

  function swapLookRole(role: string) {
    if (!currentLook) return;
    const anchors = currentLook.items.filter((_item, index) => currentLook.roles[index] !== role).map((item) => item.id);
    setLockedItemIds(anchors);
    if (user) safeSetStorage(userKey(LOCKS_KEY, user.id), JSON.stringify(anchors));
    void generateOutfit(anchors);
  }

  // Deterministic constructor creates five grounded candidates. Gemini Vision
  // can rerank/explain them, but a failure always falls back to deterministic results.
  async function generateOutfit(anchorOverride?: string[]) {
    const anchorIds = anchorOverride?.length
      ? anchorOverride
      : lockedItemIds.length
        ? lockedItemIds
        : equipped.length > 0
          ? equipped.map((i) => i.id)
          : activeItem
          ? [activeItem.id]
          : [catalog.find((item) => !["shoe", "accessory"].includes(item.category ?? item.slot))?.id].filter(Boolean) as string[];
    if (anchorIds.length === 0) return;
    setIsGenerating(true);
    setGenerateError(null);
    setStylistSource(null);
    setStylistWarning(null);

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anchors: anchorIds, wardrobeItems: userItems, preferences, feedback: outfitFeedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      let looks: Look[] = data.looks ?? [];
      if (!looks.length) throw new Error("No compatible outfits found. Try removing a conflicting piece.");

      const stylist = await fetch("/api/stylist/rerank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidates: looks, wardrobeItems: userItems, anchors: anchorIds, preferences }),
      });
      const styled = await stylist.json() as { looks?: Look[]; source?: string; warning?: string };
      if (stylist.ok && Array.isArray(styled.looks) && styled.looks.length) looks = styled.looks;
      const source = styled.source === "gemini" ? "gemini" : "deterministic";
      setStylistSource(source);
      if (styled.warning) setStylistWarning(styled.warning);

      const top = looks[0]!;
      const recs = looks.slice(0, 3);
      setRecommendedLooks(recs);
      setCurrentLook(top);
      setEquipped(top.items);
      setActiveItem(top.items[0] ?? null);

      if (user) {
        safeSetStorage(userKey(RECOMMENDED_KEY, user.id), JSON.stringify(recs.map(stripLookImages)));
        safeSetStorage(userKey(CURRENT_LOOK_KEY, user.id), JSON.stringify(stripLookImages(top)));
        safeSetStorage(userKey(EQUIPPED_KEY, user.id), JSON.stringify(top.items.map(stripItemImages)));
      }

      const modeLabel = top.stylistVerdict === "strong"
        ? "Strong match"
        : top.selectionMode === "safe"
          ? "Safe choice"
          : top.selectionMode === "expressive"
            ? "Expressive choice"
            : "Balanced choice";
      showToast(
        styled.warning
          ? `AI visual judge unavailable — deterministic engine ranked ${Math.min(3, looks.length)} looks`
          : `${source === "gemini" ? "Gemini stylist" : "Outfit engine"} ranked ${Math.min(3, looks.length)} looks · ${modeLabel}`,
      );
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
    setTryOnRenderPath(null);
    setMockPreview(null);
    if (user) {
      safeSetStorage(userKey(CURRENT_LOOK_KEY, user.id), JSON.stringify(stripLookImages(look)));
      safeSetStorage(userKey(EQUIPPED_KEY, user.id), JSON.stringify(look.items.map(stripItemImages)));
    }
    showToast(`${look.stylistTitle ?? look.formula} selected`);
  }

  function clearSuggestions() {
    setRecommendedLooks([]);
    setCurrentLook(null);
    setStylistSource(null);
    setStylistWarning(null);
    if (user) {
      safeSetStorage(userKey(RECOMMENDED_KEY, user.id), "[]");
      safeSetStorage(userKey(CURRENT_LOOK_KEY, user.id), "null");
    }
    showToast("Outfit suggestions cleared");
  }

  function clearAllEquipped() {
    setEquipped([]);
    setActiveItem(null);
    setCurrentLook(null);
    setRecommendedLooks([]);
    setStylistSource(null);
    setStylistWarning(null);
    setTryOnResult(null);
    setTryOnRenderPath(null);
    setMockPreview(null);
    if (user) {
      safeSetStorage(userKey(EQUIPPED_KEY, user.id), "[]");
      safeSetStorage(userKey(CURRENT_LOOK_KEY, user.id), "null");
      safeSetStorage(userKey(RECOMMENDED_KEY, user.id), "[]");
    }
    showToast("Cleared outfit & suggestions");
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
    setTryOnRenderPath(null);
    setMockPreview(null);
    if (user) {
      safeSetStorage(userKey(EQUIPPED_KEY, user.id), JSON.stringify(items.map(stripItemImages)));
    }
    showToast(`Equipped ${items.length} piece${items.length === 1 ? "" : "s"} from the Style Assistant`);
  }

  async function renderLook(photo: string, items: Item[]) {
    sounds.beginTryOn();
    setIsTryOnLoading(true);
    setTryOnError(null);
    setMockPreview(null);
    setTryOnResult(null);
    setTryOnRenderPath(null);

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
        body: JSON.stringify({
          photoBase64: photo,
          avatarId: activeAvatarId,
          itemIds: items.map((i) => i.id),
          items: itemsPayload,
        }),
      });
      const data = await res.json() as {
        error?: string;
        renderPath?: string;
        resultUrl?: string;
        mock?: boolean;
        renderedItemIds?: string[];
        layerWarning?: string | null;
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const expectedRenderableIds = items
        .filter((item) => !["shoe", "accessory"].includes(item.category ?? item.slot))
        .map((item) => item.id);
      if (Array.isArray(data.renderedItemIds)) {
        const renderedIds = new Set(data.renderedItemIds);
        const missing = expectedRenderableIds.filter((id) => !renderedIds.has(id));
        if (missing.length) throw new Error(`Try-on pipeline omitted ${missing.length} selected garment${missing.length === 1 ? "" : "s"}.`);
      }

      if (typeof data.resultUrl !== "string" || !data.resultUrl) throw new Error("Try-on pipeline returned no result image.");
      setTryOnRenderPath(typeof data.renderPath === "string" ? data.renderPath : null);
      if (data.mock) {
        setMockPreview({ photo, garment: data.resultUrl, title: "your look" });
      } else {
        setTryOnResult(data.resultUrl);
      }
      sounds.finishTryOn(true);
      showToast(data.layerWarning ?? (data.mock ? "Mock preview ready" : "Try-on render complete!"));
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
    const currentRenderPath = tryOnRenderPath;
    const look: SavedLook = {
      id: crypto.randomUUID(),
      image,
      renderPath: currentRenderPath,
      formula: currentLook?.formula ?? "custom",
      stylistTitle: currentLook?.stylistTitle,
      cohesion: currentLook?.cohesion,
      items,
      createdAt: Date.now(),
    };
    persistLooks([look, ...savedLooks]);
    showToast("Saved to your lookbook");
    // Persist to DB in background
    fetch("/api/looks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: look.id,
        renderPath: currentRenderPath,
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
            stylistWarning={stylistWarning}
            recommendedLooks={recommendedLooks}
            onSelectLook={chooseRecommendedLook}
            onClearSuggestions={clearSuggestions}
            onClearAll={clearAllEquipped}
            feedbackSignal={feedbackForLook(currentLook)}
            lockedItemIds={lockedItemIds}
            onFeedback={submitLookFeedback}
            onToggleLock={toggleItemLock}
            onSwapRole={swapLookRole}
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
          onUpdateUserItemSlots={updateUserItemSlots}
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

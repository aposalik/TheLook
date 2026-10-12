/**
 * Typed PostgreSQL query helpers.
 * All functions accept a Supabase client that already carries the user's
 * session — RLS enforces ownership automatically.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Item, StylePreferences } from "@/lib/recommend";

// ---------------------------------------------------------------------------
// Avatars
// ---------------------------------------------------------------------------

export type DbAvatar = {
  id: string;
  user_id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  created_at: string;
};

export async function dbListAvatars(supabase: SupabaseClient): Promise<DbAvatar[]> {
  const { data, error } = await supabase
    .from("avatars")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`dbListAvatars: ${error.message}`);
  return data ?? [];
}

export async function dbInsertAvatar(
  supabase: SupabaseClient,
  id: string,
  storagePath: string,
): Promise<void> {
  const { error } = await supabase.from("avatars").upsert({ id, storage_path: storagePath });
  if (error) throw new Error(`dbInsertAvatar: ${error.message}`);
}

export async function dbDeleteAvatar(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("avatars").delete().eq("id", id);
  if (error) throw new Error(`dbDeleteAvatar: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Wardrobe items
// ---------------------------------------------------------------------------

export type DbWardrobeItem = {
  id: string;
  user_id: string;
  storage_path: string;
  title: string;
  category: string;
  subcategory: string | null;
  layer: string | null;
  dominant_color: string | null;
  palette: string | null;
  color_role: string | null;
  fit: string | null;
  formality: number | null;
  styles: string[];
  seasons: string[];
  material: string | null;
  description: string | null;
  created_at: string;
};

export async function dbListWardrobeItems(supabase: SupabaseClient): Promise<DbWardrobeItem[]> {
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`dbListWardrobeItems: ${error.message}`);
  return data ?? [];
}

export async function dbInsertWardrobeItem(
  supabase: SupabaseClient,
  item: Item,
  storagePath: string,
): Promise<void> {
  const { error } = await supabase.from("wardrobe_items").upsert({
    id: item.id,
    storage_path: storagePath,
    title: item.title,
    category: item.category ?? item.slot,
    subcategory: item.subcategory ?? null,
    layer: item.layer ?? null,
    dominant_color: item.color ?? null,
    palette: item.palette ?? null,
    color_role: item.color_role ?? null,
    fit: item.fit ?? null,
    formality: item.formality ?? null,
    styles: item.styles ?? [],
    seasons: item.seasons ?? [],
    material: item.material ?? null,
    description: item.description ?? null,
  });
  if (error) throw new Error(`dbInsertWardrobeItem: ${error.message}`);
}

export async function dbDeleteWardrobeItem(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("wardrobe_items").delete().eq("id", id);
  if (error) throw new Error(`dbDeleteWardrobeItem: ${error.message}`);
}

// ---------------------------------------------------------------------------
// User preferences
// ---------------------------------------------------------------------------

export async function dbGetPreferences(supabase: SupabaseClient): Promise<StylePreferences | null> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("occasion, styling_goal")
    .single();
  if (error) return null;
  return { occasion: data.occasion, goal: data.styling_goal };
}

export async function dbUpsertPreferences(
  supabase: SupabaseClient,
  userId: string,
  prefs: StylePreferences,
): Promise<void> {
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: userId,
    occasion: prefs.occasion,
    styling_goal: prefs.goal,
  });
  if (error) throw new Error(`dbUpsertPreferences: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Saved looks
// ---------------------------------------------------------------------------

export type DbSavedLook = {
  id: string;
  user_id: string;
  render_path: string | null;
  stylist_title: string | null;
  formula: string;
  cohesion: number | null;
  reason: string | null;
  created_at: string;
  saved_look_items: DbSavedLookItem[];
};

export type DbSavedLookItem = {
  id: string;
  catalog_item_id: string | null;
  wardrobe_item_id: string | null;
  role: string;
  position: number;
  item_snapshot: Record<string, unknown>;
};

export async function dbListSavedLooks(supabase: SupabaseClient): Promise<DbSavedLook[]> {
  const { data, error } = await supabase
    .from("saved_looks")
    .select("*, saved_look_items(*)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`dbListSavedLooks: ${error.message}`);
  return data ?? [];
}

export async function dbInsertSavedLook(
  supabase: SupabaseClient,
  userId: string,
  look: {
    id: string;
    renderPath: string | null;
    formula: string;
    stylistTitle?: string;
    cohesion?: number;
    reason?: string;
    items: Item[];
  },
): Promise<void> {
  const { error: lookError } = await supabase.from("saved_looks").insert({
    id: look.id,
    user_id: userId,
    render_path: look.renderPath,
    formula: look.formula,
    stylist_title: look.stylistTitle ?? null,
    cohesion: look.cohesion ?? null,
    reason: look.reason ?? null,
  });
  if (lookError) throw new Error(`dbInsertSavedLook: ${lookError.message}`);

  const lookItems = look.items.map((item, i) => ({
    look_id: look.id,
    user_id: userId,
    catalog_item_id: item.source !== "user" ? item.id : null,
    wardrobe_item_id: item.source === "user" ? item.id : null,
    role: item.slot,
    position: i,
    item_snapshot: { ...item, image: undefined } as Record<string, unknown>,
  }));

  const { error: itemsError } = await supabase.from("saved_look_items").insert(lookItems);
  if (itemsError) throw new Error(`dbInsertSavedLookItems: ${itemsError.message}`);
}

export async function dbDeleteSavedLook(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("saved_looks").delete().eq("id", id);
  if (error) throw new Error(`dbDeleteSavedLook: ${error.message}`);
}

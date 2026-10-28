import type { Item } from "./recommend";

const LAYER_RANK: Record<string, number> = { base: 0, mid: 1, outer: 2 };

export type TryOnItemPlan = {
  renderable: Item[];
  styleOnly: Item[];
  dress?: Item;
  bottom?: Item;
  uppers: Item[];
};

export function partitionTryOnItems(items: Item[]): TryOnItemPlan {
  const renderable = items.filter((item) => !["shoe", "accessory"].includes(item.category ?? item.slot));
  const styleOnly = items.filter((item) => ["shoe", "accessory"].includes(item.category ?? item.slot));
  const dress = renderable.find((item) => item.slot === "dress" || item.category === "dress");
  const bottom = renderable.find((item) => item.slot === "bottom" || item.category === "bottom");
  const uppers = renderable
    .filter((item) => item.slot === "innerwear" || item.slot === "top" || item.slot === "outerwear" || item.category === "upper")
    .sort((a, b) => (LAYER_RANK[a.layer ?? "base"] ?? 0) - (LAYER_RANK[b.layer ?? "base"] ?? 0));
  return { renderable, styleOnly, dress, bottom, uppers };
}

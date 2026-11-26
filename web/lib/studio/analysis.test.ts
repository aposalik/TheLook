import assert from "node:assert/strict";
import test from "node:test";
import { createStudioDocument, type OutfitStudioDocument } from "./document";
import { analyzeManualLook } from "./analysis";

const base = (nodes: OutfitStudioDocument["nodes"]): OutfitStudioDocument => ({ ...createStudioDocument({ id: "20000000-0000-0000-0000-000000000001", ownerId: "00000000-0000-0000-0000-000000000001", now: "2026-11-26T18:00:00.000Z" }), nodes });
const node = (id: string, role: OutfitStudioDocument["nodes"][number]["wearingRole"], category: string, title: string, zIndex: number) => ({ id, itemId: `catalog-${id}`, itemSource: "catalog" as const, itemSnapshot: { id: `catalog-${id}`, slot: category === "shoe" ? "shoe" : category === "bottom" ? "bottom" : "top", title, color: "#223344", palette: "neutral", category, layer: role === "outer" ? "outer" : role === "mid" ? "mid" : "base", source: "catalog" as const }, x: .2, y: .2, width: .3, height: .3, rotation: 0, zIndex, opacity: 1, flipX: false, locked: false, wearingRole: role });

test("deterministically scores a physically valid manual look", () => {
 const result = analyzeManualLook(base([node("30000000-0000-0000-0000-000000000001", "base", "upper", "T-shirt", 0), node("30000000-0000-0000-0000-000000000002", "bottom", "bottom", "Jeans", 1), node("30000000-0000-0000-0000-000000000003", "shoe", "shoe", "Sneakers", 2)]));
 assert.equal(result.hardValid, true); assert.equal(result.issues.length, 0); assert.equal(result.scores.total > .7, true); assert.equal(result.tags.includes("grounded"), true);
});
test("warns without blocking creative invalid manual layering", () => {
 const document = base([node("30000000-0000-0000-0000-000000000001", "base", "upper", "Hoodie", 0), node("30000000-0000-0000-0000-000000000002", "mid", "upper", "Light shirt", 1), node("30000000-0000-0000-0000-000000000003", "bottom", "bottom", "Jeans", 2)]);
 const a = analyzeManualLook(document); const b = analyzeManualLook(document);
 assert.equal(a.hardValid, false); assert.equal(a.issues.length > 0, true); assert.deepEqual(a, b);
});

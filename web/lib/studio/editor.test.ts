import assert from "node:assert/strict";
import test from "node:test";
import type { Item } from "../recommend";
import {
  addGarment,
  bringForward,
  createEditorState,
  deleteSelected,
  redo,
  sendBackward,
  transformNode,
  undo,
} from "./editor";

const top: Item = {
  id: "top-shirt",
  slot: "top",
  title: "Blue shirt",
  color: "#557799",
  palette: "cool",
  image: "/cutouts/top_shirt-blue.png",
  category: "upper",
};

const bottom: Item = {
  id: "bottom-jeans",
  slot: "bottom",
  title: "Jeans",
  color: "#667788",
  palette: "cool",
  image: "/cutouts/bottom_jeans-lightblue.png",
  category: "bottom",
};

test("adds garments with category-aware normalized placement", () => {
  const first = addGarment(createEditorState(), top);
  const second = addGarment(first, bottom);

  assert.equal(second.present.nodes.length, 2);
  assert.equal(second.present.selectedNodeId, second.present.nodes[1]?.id);
  assert.ok(second.present.nodes[0]!.y < second.present.nodes[1]!.y);
  assert.deepEqual(second.present.nodes.map((node) => node.zIndex), [0, 1]);
  assert.equal(second.past.length, 2);
});

test("commits one transform and restores it through undo and redo", () => {
  const added = addGarment(createEditorState(), top);
  const node = added.present.nodes[0]!;
  const moved = transformNode(added, node.id, {
    x: 0.3,
    y: 0.22,
    width: 0.4,
    height: 0.35,
    rotation: 8,
  });

  assert.equal(moved.past.length, 2);
  assert.equal(moved.present.nodes[0]!.x, 0.3);
  assert.equal(undo(moved).present.nodes[0]!.x, node.x);
  assert.equal(redo(undo(moved)).present.nodes[0]!.rotation, 8);
});

test("normalizes visual order when sending nodes backward and forward", () => {
  let state = addGarment(createEditorState(), top);
  state = addGarment(state, bottom);
  const topId = state.present.nodes[0]!.id;
  const bottomId = state.present.nodes[1]!.id;

  state = bringForward(state, topId);
  assert.deepEqual(state.present.nodes.map((node) => [node.item.id, node.zIndex]), [
    ["bottom-jeans", 0],
    ["top-shirt", 1],
  ]);

  state = sendBackward(state, topId);
  assert.deepEqual(state.present.nodes.map((node) => [node.item.id, node.zIndex]), [
    ["top-shirt", 0],
    ["bottom-jeans", 1],
  ]);
  assert.equal(state.present.nodes.find((node) => node.id === bottomId)?.zIndex, 1);
});

test("deletes the selected garment and can undo the deletion", () => {
  const added = addGarment(createEditorState(), top);
  const deleted = deleteSelected(added);

  assert.equal(deleted.present.nodes.length, 0);
  assert.equal(deleted.present.selectedNodeId, null);
  assert.equal(undo(deleted).present.nodes.length, 1);
});

test("caps command history at one hundred snapshots", () => {
  let state = addGarment(createEditorState(), top);
  const id = state.present.nodes[0]!.id;
  for (let index = 0; index < 120; index += 1) {
    state = transformNode(state, id, { x: (index % 80) / 100 });
  }
  assert.equal(state.past.length, 100);
});

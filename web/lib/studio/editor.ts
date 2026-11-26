import type { Item } from "../recommend";

export const MAX_STUDIO_NODES = 12;
const MAX_HISTORY = 100;

export type NodeTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type StudioNode = NodeTransform & {
  id: string;
  item: Item;
  zIndex: number;
  locked: boolean;
};

export type StudioSnapshot = {
  nodes: StudioNode[];
  selectedNodeId: string | null;
};

export type StudioEditorState = {
  past: StudioSnapshot[];
  present: StudioSnapshot;
  future: StudioSnapshot[];
};

function cloneSnapshot(snapshot: StudioSnapshot): StudioSnapshot {
  return {
    selectedNodeId: snapshot.selectedNodeId,
    nodes: snapshot.nodes.map((node) => ({ ...node })),
  };
}

function commit(state: StudioEditorState, present: StudioSnapshot): StudioEditorState {
  return {
    past: [...state.past, cloneSnapshot(state.present)].slice(-MAX_HISTORY),
    present,
    future: [],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function defaultTransform(item: Item, index: number): NodeTransform {
  const offset = (index % 4) * 0.018;
  if (item.category === "bottom" || item.slot === "bottom") {
    return { x: 0.32 + offset, y: 0.5 + offset, width: 0.36, height: 0.38, rotation: 0 };
  }
  if (item.category === "shoe" || item.slot === "shoe") {
    return { x: 0.33 + offset, y: 0.79 - offset, width: 0.34, height: 0.16, rotation: 0 };
  }
  if (item.category === "accessory" || item.slot === "accessory") {
    return { x: 0.68 - offset, y: 0.2 + offset, width: 0.22, height: 0.22, rotation: 0 };
  }
  if (item.category === "dress" || item.slot === "dress") {
    return { x: 0.28 + offset, y: 0.14 + offset, width: 0.44, height: 0.62, rotation: 0 };
  }
  return { x: 0.3 + offset, y: 0.12 + offset, width: 0.4, height: 0.36, rotation: 0 };
}

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `studio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeOrder(nodes: StudioNode[]): StudioNode[] {
  return nodes
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((node, zIndex) => ({ ...node, zIndex }));
}

export function createEditorState(nodes: StudioNode[] = []): StudioEditorState {
  return {
    past: [],
    present: { nodes: normalizeOrder(nodes), selectedNodeId: null },
    future: [],
  };
}

export function selectNode(state: StudioEditorState, id: string | null): StudioEditorState {
  if (state.present.selectedNodeId === id) return state;
  return { ...state, present: { ...state.present, selectedNodeId: id } };
}

export function addGarment(
  state: StudioEditorState,
  item: Item,
  position?: Pick<NodeTransform, "x" | "y">,
): StudioEditorState {
  if (state.present.nodes.length >= MAX_STUDIO_NODES) return state;
  const initial = defaultTransform(item, state.present.nodes.length);
  const node: StudioNode = {
    id: createId(),
    item,
    zIndex: state.present.nodes.length,
    locked: false,
    ...initial,
    ...(position ? {
      x: clamp(position.x - initial.width / 2, -0.8, 0.95),
      y: clamp(position.y - initial.height / 2, -0.8, 0.95),
    } : {}),
  };
  return commit(state, {
    nodes: [...state.present.nodes, node],
    selectedNodeId: node.id,
  });
}

export function transformNode(
  state: StudioEditorState,
  id: string,
  patch: Partial<NodeTransform>,
): StudioEditorState {
  let changed = false;
  const nodes = state.present.nodes.map((node) => {
    if (node.id !== id || node.locked) return node;
    const next: StudioNode = {
      ...node,
      x: patch.x === undefined ? node.x : clamp(patch.x, -0.8, 0.95),
      y: patch.y === undefined ? node.y : clamp(patch.y, -0.8, 0.95),
      width: patch.width === undefined ? node.width : clamp(patch.width, 0.05, 1.5),
      height: patch.height === undefined ? node.height : clamp(patch.height, 0.05, 1.5),
      rotation: patch.rotation === undefined ? node.rotation : clamp(patch.rotation, -180, 180),
    };
    changed = next.x !== node.x || next.y !== node.y || next.width !== node.width
      || next.height !== node.height || next.rotation !== node.rotation;
    return next;
  });
  if (!changed) return state;
  return commit(state, { ...state.present, nodes, selectedNodeId: id });
}

function moveOrder(state: StudioEditorState, id: string, direction: -1 | 1): StudioEditorState {
  const nodes = normalizeOrder(state.present.nodes);
  const index = nodes.findIndex((node) => node.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= nodes.length) return state;
  [nodes[index], nodes[target]] = [nodes[target]!, nodes[index]!];
  return commit(state, {
    selectedNodeId: id,
    nodes: normalizeOrder(nodes.map((node, zIndex) => ({ ...node, zIndex }))),
  });
}

export function bringForward(state: StudioEditorState, id: string): StudioEditorState {
  return moveOrder(state, id, 1);
}

export function sendBackward(state: StudioEditorState, id: string): StudioEditorState {
  return moveOrder(state, id, -1);
}

export function toggleNodeLock(state: StudioEditorState, id: string): StudioEditorState {
  const nodes = state.present.nodes.map((node) => node.id === id ? { ...node, locked: !node.locked } : node);
  if (nodes.every((node, index) => node === state.present.nodes[index])) return state;
  return commit(state, { ...state.present, nodes, selectedNodeId: id });
}

export function deleteSelected(state: StudioEditorState): StudioEditorState {
  const id = state.present.selectedNodeId;
  if (!id) return state;
  const nodes = state.present.nodes.filter((node) => node.id !== id);
  if (nodes.length === state.present.nodes.length) return state;
  return commit(state, { nodes: normalizeOrder(nodes), selectedNodeId: null });
}

export function clearCanvas(state: StudioEditorState): StudioEditorState {
  if (!state.present.nodes.length) return state;
  return commit(state, { nodes: [], selectedNodeId: null });
}

export function undo(state: StudioEditorState): StudioEditorState {
  const previous = state.past.at(-1);
  if (!previous) return state;
  return {
    past: state.past.slice(0, -1),
    present: cloneSnapshot(previous),
    future: [cloneSnapshot(state.present), ...state.future].slice(0, MAX_HISTORY),
  };
}

export function redo(state: StudioEditorState): StudioEditorState {
  const next = state.future[0];
  if (!next) return state;
  return {
    past: [...state.past, cloneSnapshot(state.present)].slice(-MAX_HISTORY),
    present: cloneSnapshot(next),
    future: state.future.slice(1),
  };
}

"use client";
/* eslint-disable @next/next/no-img-element -- native images preserve signed URL CORS behavior for Canvas export */

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { NodeTransform, StudioNode } from "@/lib/studio/editor";

const ARTBOARD_MIME = "application/x-thelook-wardrobe-item";

type Props = {
  nodes: StudioNode[];
  selectedNodeId: string | null;
  onSelect: (id: string | null) => void;
  onTransform: (id: string, transform: Partial<NodeTransform>) => void;
  onDropItem: (itemId: string, position: { x: number; y: number }) => void;
};

type Gesture = {
  mode: "drag" | "resize";
  pointerX: number;
  pointerY: number;
  initial: NodeTransform;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function GarmentNode({
  node,
  selected,
  onSelect,
  onTransform,
}: {
  node: StudioNode;
  selected: boolean;
  onSelect: (id: string) => void;
  onTransform: (id: string, transform: NodeTransform) => void;
}) {
  const [draftOverride, setDraftOverride] = useState<NodeTransform | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const draftRef = useRef<NodeTransform>(node);
  const draft = draftOverride ?? node;

  function beginGesture(event: ReactPointerEvent<HTMLElement>, mode: Gesture["mode"]) {
    event.preventDefault();
    event.stopPropagation();
    onSelect(node.id);
    if (node.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const initial = { x: draft.x, y: draft.y, width: draft.width, height: draft.height, rotation: draft.rotation };
    draftRef.current = initial;
    gestureRef.current = {
      mode,
      pointerX: event.clientX,
      pointerY: event.clientY,
      initial,
    };
  }

  function moveGesture(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    const artboard = event.currentTarget.closest<HTMLElement>("[data-studio-artboard]");
    if (!gesture || !artboard) return;
    event.preventDefault();
    const bounds = artboard.getBoundingClientRect();
    const dx = (event.clientX - gesture.pointerX) / bounds.width;
    const dy = (event.clientY - gesture.pointerY) / bounds.height;
    let next: NodeTransform;

    if (gesture.mode === "drag") {
      next = {
        ...gesture.initial,
        x: clamp(gesture.initial.x + dx, -gesture.initial.width * 0.8, 1 - gesture.initial.width * 0.2),
        y: clamp(gesture.initial.y + dy, -gesture.initial.height * 0.8, 1 - gesture.initial.height * 0.2),
      };
    } else {
      const relativeDelta = Math.max(dx / Math.max(gesture.initial.width, 0.05), dy / Math.max(gesture.initial.height, 0.05));
      const scale = clamp(1 + relativeDelta, 0.2, 3);
      next = {
        ...gesture.initial,
        width: clamp(gesture.initial.width * scale, 0.05, 1.5),
        height: clamp(gesture.initial.height * scale, 0.05, 1.5),
      };
    }

    draftRef.current = next;
    setDraftOverride(next);
  }

  function endGesture(event: ReactPointerEvent<HTMLElement>) {
    if (!gestureRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    gestureRef.current = null;
    onTransform(node.id, draftRef.current);
    setDraftOverride(null);
  }

  return (
    <div
      className={`group absolute touch-none select-none ${node.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
      style={{
        left: `${draft.x * 100}%`,
        top: `${draft.y * 100}%`,
        width: `${draft.width * 100}%`,
        height: `${draft.height * 100}%`,
        transform: `rotate(${draft.rotation}deg)`,
        zIndex: node.zIndex + 1,
      }}
      role="button"
      tabIndex={0}
      aria-label={`${node.item.title}${node.locked ? ", locked" : ""}`}
      aria-pressed={selected}
      onPointerDown={(event) => beginGesture(event, "drag")}
      onPointerMove={moveGesture}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(node.id);
        }
      }}
    >
      <img
        src={node.item.image}
        alt=""
        draggable={false}
        crossOrigin="anonymous"
        className="pointer-events-none h-full w-full object-contain drop-shadow-[0_12px_16px_rgba(32,26,18,0.14)]"
      />
      {selected && (
        <>
          <span className="pointer-events-none absolute inset-0 rounded-md border-2 border-[#1f6b55] shadow-[0_0_0_1px_white]" />
          <span className="pointer-events-none absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#1f6b55] shadow" />
          <button
            type="button"
            aria-label={`Resize ${node.item.title}`}
            title="Drag to resize"
            className="absolute -bottom-2 -right-2 h-5 w-5 cursor-nwse-resize rounded-md border-2 border-white bg-[#1f6b55] shadow-md"
            onPointerDown={(event) => beginGesture(event, "resize")}
            onPointerMove={moveGesture}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
          />
        </>
      )}
    </div>
  );
}

export default function StudioArtboard({ nodes, selectedNodeId, onSelect, onTransform, onDropItem }: Props) {
  return (
    <div className="relative flex min-h-0 min-w-0 w-full flex-1 items-center justify-center overflow-hidden rounded-[28px] border border-[#ded8cd] bg-[#e9e4da] p-3 sm:p-5">
      <div
        data-studio-artboard
        className="relative aspect-[4/5] w-full max-w-full overflow-hidden rounded-[22px] bg-[#f4f0e8] shadow-[0_25px_80px_rgba(45,38,28,0.18)] ring-1 ring-black/5 before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,.8),transparent_35%)] sm:max-w-[520px] lg:h-full lg:max-h-[calc(100vh-15rem)] lg:w-auto lg:max-w-full"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onSelect(null);
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes(ARTBOARD_MIME)) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          const itemId = event.dataTransfer.getData(ARTBOARD_MIME);
          if (!itemId) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          onDropItem(itemId, {
            x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
            y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
          });
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-4 z-0 text-center text-[9px] font-semibold uppercase tracking-[0.28em] text-[#b8afa1]">
          TheLook · Outfit Study
        </div>

        {nodes.map((node) => (
          <GarmentNode
            key={node.id}
            node={node}
            selected={node.id === selectedNodeId}
            onSelect={onSelect}
            onTransform={(id, transform) => onTransform(id, transform)}
          />
        ))}

        {!nodes.length && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center">
            <div>
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border border-dashed border-[#b8aa96] bg-white/55 text-2xl text-[#796b59]">+</div>
              <p className="font-serif text-2xl text-[#342f29]">Build a look from your wardrobe</p>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-[#81786e]">Tap a piece below or drag it onto this artboard.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { ARTBOARD_MIME };

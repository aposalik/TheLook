"use client";
import React from "react";

// <model-viewer> is a custom element registered by the Google script loaded in
// layout.tsx. We render it via createElement so we don't need to augment JSX types.
export default function ModelViewer({ src }: { src: string }) {
  return React.createElement("model-viewer", {
    src,
    "camera-controls": true,
    "auto-rotate": true,
    "shadow-intensity": "1",
    exposure: "1",
    style: { width: "100%", height: "400px", background: "#F7F5F0", borderRadius: "1rem" },
  });
}

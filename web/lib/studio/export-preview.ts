import type { StudioNode } from "./editor";

const EXPORT_WIDTH = 1600;
const EXPORT_HEIGHT = 2000;

async function loadDrawable(source: string): Promise<ImageBitmap | HTMLImageElement> {
  try {
    const response = await fetch(source, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Image request failed (${response.status})`);
    return createImageBitmap(await response.blob());
  } catch (fetchError) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(fetchError instanceof Error ? fetchError : new Error("Image could not be loaded"));
      image.src = source;
    });
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("The browser could not encode the outfit preview.")),
      "image/webp",
      0.92,
    );
  });
}

export async function exportStudioPreview(nodes: StudioNode[]): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas export is unavailable in this browser.");

  context.fillStyle = "#f4f0e8";
  context.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

  const ordered = nodes.slice().sort((a, b) => a.zIndex - b.zIndex);
  for (const node of ordered) {
    const drawable = await loadDrawable(node.item.image);
    const width = node.width * EXPORT_WIDTH;
    const height = node.height * EXPORT_HEIGHT;
    const centerX = node.x * EXPORT_WIDTH + width / 2;
    const centerY = node.y * EXPORT_HEIGHT + height / 2;

    context.save();
    context.translate(centerX, centerY);
    context.rotate((node.rotation * Math.PI) / 180);
    context.shadowColor = "rgba(28, 24, 18, 0.12)";
    context.shadowBlur = 28;
    context.shadowOffsetY = 14;
    context.drawImage(drawable, -width / 2, -height / 2, width, height);
    context.restore();

    if (drawable instanceof ImageBitmap) drawable.close();
  }

  return canvasToBlob(canvas);
}

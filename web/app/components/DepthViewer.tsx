"use client";
import { useEffect, useRef, useState } from "react";

// Free, no-API "3D photo": estimate a depth map from the image in-browser with
// transformers.js (Depth-Anything), then render the photo as a displaced mesh in
// three.js you can tilt/orbit. Front has real relief; the back is empty (2.5D).
export default function DepthViewer({ src }: { src: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Loading depth model…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const { pipeline, env } = await import("@huggingface/transformers");
        env.allowLocalModels = false; // fetch the model from the HF CDN

        // 1) depth map (runs on WebGPU if available, else WASM)
        setStatus("Estimating depth…");
        const estimator = await pipeline("depth-estimation", "onnx-community/depth-anything-v2-small", {
          device: (navigator as unknown as { gpu?: unknown }).gpu ? "webgpu" : "wasm",
        });
        if (disposed) return;
        const out = (await estimator(src)) as { depth: { data: Uint8Array; width: number; height: number } };
        if (disposed) return;

        // depth RawImage -> grayscale canvas (handle 1/3/4 channel strides)
        const { data, width: dw, height: dh } = out.depth;
        const stride = Math.max(1, Math.round(data.length / (dw * dh)));
        const dCanvas = document.createElement("canvas");
        dCanvas.width = dw; dCanvas.height = dh;
        const dCtx = dCanvas.getContext("2d")!;
        const idata = dCtx.createImageData(dw, dh);
        for (let i = 0; i < dw * dh; i++) {
          const v = data[i * stride]!;
          idata.data[i * 4] = v; idata.data[i * 4 + 1] = v; idata.data[i * 4 + 2] = v; idata.data[i * 4 + 3] = 255;
        }
        dCtx.putImageData(idata, 0, 0);

        // 2) load the photo (for aspect + color texture)
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        await img.decode().catch(() => {});
        if (disposed) return;
        const aspect = (img.naturalWidth || dw) / (img.naturalHeight || dh);

        // 3) three.js scene: displaced plane
        setStatus("");
        const mount = mountRef.current!;
        const W = mount.clientWidth || 360, H = 400;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setSize(W, H);
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
        camera.position.set(0, 0, 3.2);

        const colorTex = new THREE.CanvasTexture((() => {
          const c = document.createElement("canvas"); c.width = img.naturalWidth || dw; c.height = img.naturalHeight || dh;
          c.getContext("2d")!.drawImage(img, 0, 0); return c;
        })());
        colorTex.colorSpace = THREE.SRGBColorSpace;
        const depthTex = new THREE.CanvasTexture(dCanvas);

        const planeH = 2, planeW = planeH * aspect;
        const geo = new THREE.PlaneGeometry(planeW, planeH, 220, 220);
        const mat = new THREE.MeshStandardMaterial({
          map: colorTex, displacementMap: depthTex, displacementScale: 0.6, roughness: 1, metalness: 0,
        });
        const mesh = new THREE.Mesh(geo, mat);
        scene.add(mesh);
        scene.add(new THREE.AmbientLight(0xffffff, 1.1));
        const dir = new THREE.DirectionalLight(0xffffff, 0.5); dir.position.set(0, 0, 4); scene.add(dir);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.enableZoom = true;
        controls.minDistance = 2.2; controls.maxDistance = 5;
        controls.minPolarAngle = Math.PI / 3; controls.maxPolarAngle = (2 * Math.PI) / 3; // don't flip behind
        controls.minAzimuthAngle = -0.7; controls.maxAzimuthAngle = 0.7;                   // limited left/right

        let raf = 0;
        const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
        loop();

        const onResize = () => {
          const w = mount.clientWidth || W; renderer.setSize(w, H);
          camera.aspect = w / H; camera.updateProjectionMatrix();
        };
        window.addEventListener("resize", onResize);

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", onResize);
          controls.dispose(); geo.dispose(); mat.dispose(); colorTex.dispose(); depthTex.dispose();
          renderer.dispose();
          if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        };
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => { disposed = true; cleanup(); };
  }, [src]);

  return (
    <div className="w-full">
      <div ref={mountRef} className="w-full rounded-2xl bg-[#F7F5F0] overflow-hidden" style={{ height: 400 }} />
      {status && <p className="mt-2 text-center text-xs text-[#8A8480]">{status}</p>}
      {error && <p className="mt-2 text-center text-xs text-red-500 break-words">3D failed: {error}</p>}
      {!status && !error && <p className="mt-2 text-center text-[11px] text-[#8A8480]">Drag to tilt · scroll to zoom — a depth-based 3D photo (free, on-device)</p>}
    </div>
  );
}

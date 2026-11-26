import type { Metadata } from "next";
import OutfitStudio from "@/app/components/studio/OutfitStudio";
import { getCatalog } from "@/lib/recommend";

export const metadata: Metadata = {
  title: "Outfit Studio · TheLook",
  description: "Build a manual outfit from your own wardrobe.",
};

export default function OutfitStudioPage() {
  return <OutfitStudio catalog={getCatalog()} />;
}

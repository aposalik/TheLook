import catalog from "@/data/catalog.json";
import TryOn from "../components/TryOn";

type Item = { id: string; slot: string; title: string; image: string };

export default function TryOnPage() {
  return <TryOn catalog={catalog as Item[]} />;
}

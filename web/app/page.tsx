import { getCatalog } from "@/lib/recommend";
import CompleteLook from "./components/CompleteLook";

export default function Home() {
  return <CompleteLook catalog={getCatalog()} />;
}

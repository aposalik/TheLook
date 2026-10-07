import { getCatalog } from "@/lib/recommend";
import FittingRoom from "./components/FittingRoom";

export default function Home() {
  return <FittingRoom catalog={getCatalog()} />;
}

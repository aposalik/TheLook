import type { Metadata } from "next";
import AdminControlCenter from "../components/admin/AdminControlCenter";

export const metadata: Metadata = {
  title: "Control Room · TheLook",
  description: "TheLook operations and administration control center design.",
};

export default function AdminPage() {
  return <AdminControlCenter />;
}

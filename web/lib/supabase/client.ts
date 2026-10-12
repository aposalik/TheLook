import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "./config";

export function createClient() {
  const { url, publishableKey } = requireSupabaseConfig();
  return createBrowserClient(url, publishableKey);
}

/**
 * Server-side Supabase Storage helpers.
 * Uses the service-role key so it can write to any user's private folder.
 * Never expose this module to the browser.
 */
import { createClient } from "@supabase/supabase-js";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service-role key is not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Upload bytes to a private bucket. Overwrites if the path already exists. */
export async function uploadToStorage(
  bucket: "avatars" | "wardrobe" | "renders",
  path: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  const supabase = serviceClient();
  const { error } = await supabase.storage.from(bucket).upload(path, data, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed (${bucket}/${path}): ${error.message}`);
}

/** Generate a signed URL valid for the given number of seconds (default 1 hour). */
export async function signedUrl(
  bucket: "avatars" | "wardrobe" | "renders",
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const supabase = serviceClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw new Error(`Could not sign URL (${bucket}/${path}): ${error?.message}`);
  return data.signedUrl;
}

/** Delete an object from a private bucket. Silently ignores not-found. */
export async function deleteFromStorage(
  bucket: "avatars" | "wardrobe" | "renders",
  path: string,
): Promise<void> {
  const supabase = serviceClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Storage delete failed (${bucket}/${path}): ${error.message}`);
}

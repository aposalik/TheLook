import "server-only";
import { createClient } from "../supabase/server";

export class StudioAuthError extends Error {
  constructor(message: string, readonly status: 401 | 403) {
    super(message);
    this.name = "StudioAuthError";
  }
}

export async function requirePermanentStudioUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new StudioAuthError("Not authenticated.", 401);
  if (data.user.is_anonymous) throw new StudioAuthError("A permanent account is required for cloud outfit saving.", 403);
  return { supabase, user: data.user };
}

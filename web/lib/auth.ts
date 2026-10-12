import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireVerifiedAccount() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Sign in to use Show on me." }, { status: 401 }),
    };
  }

  const user = data.user;
  const verified = !user.is_anonymous && Boolean(
    user.email_confirmed_at || user.app_metadata.provider === "google",
  );

  if (!verified) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "A verified Google or email account is required for Show on me." },
        { status: 403 },
      ),
    };
  }

  return { user, response: null };
}

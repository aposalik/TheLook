import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizedSet(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminUser(user: Pick<User, "id" | "email">): boolean {
  const ids = normalizedSet(process.env.ADMIN_USER_IDS);
  const emails = normalizedSet(process.env.ADMIN_EMAILS);
  return ids.has(user.id.toLowerCase()) || Boolean(user.email && emails.has(user.email.toLowerCase()));
}

export function rejectCrossOriginMutation(req: NextRequest): NextResponse | null {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return NextResponse.json({ error: "Cross-origin admin mutation rejected." }, { status: 403 });
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return NextResponse.json({ error: "Admin mutations require a same-origin browser request." }, { status: 403 });
  try {
    if (new URL(origin).host !== host) return NextResponse.json({ error: "Cross-origin admin mutation rejected." }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  return null;
}

export function adminConfigured(): boolean {
  return normalizedSet(process.env.ADMIN_USER_IDS).size > 0 || normalizedSet(process.env.ADMIN_EMAILS).size > 0;
}

export async function requireAdmin() {
  const sessionClient = await createClient();
  const { data, error } = await sessionClient.auth.getUser();
  if (error || !data.user) {
    return {
      user: null,
      admin: null,
      response: NextResponse.json({ error: "Sign in to access the control room." }, { status: 401 }),
    };
  }
  const verified = !data.user.is_anonymous && Boolean(
    data.user.email_confirmed_at || data.user.app_metadata.provider === "google",
  );
  if (!verified || !isAdminUser(data.user)) {
    return {
      user: null,
      admin: null,
      response: NextResponse.json({ error: "This account is not authorized for administration." }, { status: 403 }),
    };
  }
  return { user: data.user, admin: createAdminClient(), response: null };
}

export async function writeAdminAudit({
  actor,
  action,
  targetType,
  targetId,
  reason,
  metadata = {},
}: {
  actor: Pick<User, "id" | "email">;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_audit_logs").insert({
    actor_user_id: actor.id,
    actor_email: actor.email ?? null,
    action,
    target_type: targetType,
    target_id: targetId ?? null,
    reason,
    metadata,
  });
  if (error) throw new Error(`Could not write admin audit event: ${error.message}`);
}

/**
 * Server-side YouCam credit quota helpers.
 * All DB calls use the service-role key — the route verifies session ownership first.
 * Raw IPs are never stored; only a one-way HMAC-SHA256 hash is persisted.
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service-role key is not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/** HMAC-SHA256 the raw IP with a server-only secret. Never stores the raw IP. */
export function hashIp(rawIp: string): string {
  const secret = process.env.RATE_LIMIT_HASH_SECRET;
  if (!secret) {
    throw new Error("RATE_LIMIT_HASH_SECRET is required when real try-on rendering is enabled.");
  }
  return crypto.createHmac("sha256", secret).update(rawIp).digest("hex");
}

/** Extract the trusted client IP from Vercel's x-forwarded-for header. */
export function trustedIp(req: { headers: { get(name: string): string | null } }): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0]?.trim() || "unknown";
}

export type QuotaResult =
  | { ok: true; jobId: string; remaining: number }
  | { ok: false; reason: "disabled" | "global_budget" | "user_limit" | "in_flight" | "cached"; cachedPath?: string; remaining?: number; resetUtc?: string };

const UNLIMITED_RENDER_EMAILS = new Set(["demo@gmail.com"]);

/**
 * Atomically reserve a render slot.
 * Returns ok:true + jobId on success, or ok:false + reason on rejection.
 */
export async function reserveQuota(
  userId: string,
  fingerprint: string,
  ipHash: string,
  avatarId: string,
  items: unknown[],
  userEmail?: string | null,
): Promise<QuotaResult> {
  const supabase = serviceClient();
  let resolvedEmail = userEmail?.trim().toLowerCase() ?? "";
  if (!resolvedEmail) {
    const { data: adminUser } = await supabase.auth.admin.getUserById(userId);
    resolvedEmail = adminUser?.user?.email?.trim().toLowerCase() ?? "";
  }
  const isUnlimitedUser = Boolean(
    resolvedEmail && UNLIMITED_RENDER_EMAILS.has(resolvedEmail),
  );

  if (isUnlimitedUser) {
    // Clear any accumulated daily_user_usage for demo@gmail.com in the DB
    await supabase.from("daily_user_usage").delete().eq("user_id", userId);

    // Check if this exact look was already rendered (cache hit)
    const { data: existing } = await supabase
      .from("render_jobs")
      .select("id, status, result_path")
      .eq("user_id", userId)
      .eq("fingerprint", fingerprint)
      .maybeSingle();

    if (existing?.status === "completed" && existing.result_path) {
      return { ok: false, reason: "cached", cachedPath: existing.result_path as string };
    }
    if (existing && existing.status !== "completed") {
      await supabase.from("render_jobs").delete().eq("id", existing.id);
    }

    const jobId = crypto.randomUUID();
    const { error: insertErr } = await supabase.from("render_jobs").insert({
      id: jobId,
      user_id: userId,
      avatar_id: avatarId,
      fingerprint,
      status: "queued",
      selected_items: items,
    });
    if (insertErr) throw new Error(`reserve_render_quota (unlimited bypass): ${insertErr.message}`);
    return { ok: true, jobId, remaining: 9999 };
  }

  const { data, error } = await supabase.rpc("reserve_render_quota", {
    p_user_id: userId,
    p_fingerprint: fingerprint,
    p_ip_hash: ipHash,
    p_avatar_id: avatarId,
    p_items: items,
  });
  if (error) throw new Error(`reserve_render_quota: ${error.message}`);
  const result = data as Record<string, unknown>;
  if (result.ok) {
    return {
      ok: true,
      jobId: result.job_id as string,
      remaining: result.remaining as number,
    };
  }

  return {
    ok: false,
    reason: result.reason as (QuotaResult & { ok: false })["reason"],
    cachedPath: result.cached_path as string | undefined,
    remaining: result.remaining as number | undefined,
    resetUtc: result.reset_utc as string | undefined,
  };
}

/** Mark a render job completed and record actual units consumed. */
export async function completeJob(jobId: string, resultPath: string, units = 1): Promise<void> {
  const supabase = serviceClient();
  const { error } = await supabase.rpc("complete_render_job", {
    p_job_id: jobId,
    p_result_path: resultPath,
    p_units: units,
  });
  if (error) throw new Error(`complete_render_job: ${error.message}`);
}

/** Mark a render job failed and refund the quota reservation. */
export async function failJob(jobId: string, errorCode: string, errorMessage?: string): Promise<void> {
  const supabase = serviceClient();
  const { error } = await supabase.rpc("fail_render_job", {
    p_job_id: jobId,
    p_error_code: errorCode,
    p_error_message: errorMessage ?? null,
  });
  if (error) throw new Error(`fail_render_job: ${error.message}`);
}

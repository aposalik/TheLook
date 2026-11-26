import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import type { AdminSnapshot } from "@/lib/admin-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberOrZero(value: number | null) {
  return typeof value === "number" ? value : 0;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.response || !auth.user || !auth.admin) return auth.response!;
  const admin = auth.admin;

  try {
    const [
      authUsers,
      wardrobeCount,
      lookCount,
      feedbackCount,
      renderCount,
      completedCount,
      failedCount,
      todayUsage,
      totalUsage,
      settingsResult,
      rendersResult,
      wardrobeResult,
      auditResult,
    ] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("wardrobe_items").select("id", { count: "exact", head: true }),
      admin.from("saved_looks").select("id", { count: "exact", head: true }),
      admin.from("outfit_feedback").select("id", { count: "exact", head: true }),
      admin.from("render_jobs").select("id", { count: "exact", head: true }),
      admin.from("render_jobs").select("id", { count: "exact", head: true }).eq("status", "completed"),
      admin.from("render_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
      admin.from("global_usage").select("try_on_count, youcam_units").eq("day", new Date().toISOString().slice(0, 10)).maybeSingle(),
      admin.from("global_usage").select("youcam_units"),
      admin.from("render_settings").select("*").eq("id", true).single(),
      admin.from("render_jobs").select("id,user_id,status,selected_items,youcam_units,error_code,created_at,completed_at").order("created_at", { ascending: false }).limit(20),
      admin.from("wardrobe_items").select("id,user_id,title,category,layer,created_at").order("created_at", { ascending: false }).limit(20),
      admin.from("admin_audit_logs").select("id,actor_email,action,target_type,target_id,reason,created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    const failures = [
      authUsers.error,
      wardrobeCount.error,
      lookCount.error,
      feedbackCount.error,
      renderCount.error,
      completedCount.error,
      failedCount.error,
      todayUsage.error,
      totalUsage.error,
      settingsResult.error,
      rendersResult.error,
      wardrobeResult.error,
    ].filter(Boolean);
    if (failures.length) throw new Error(failures.map((error) => error?.message).join("; "));

    const users = authUsers.data.users;
    const permanentUsers = users.filter((user) => !user.is_anonymous).length;
    const anonymousUsers = users.filter((user) => user.is_anonymous).length;
    const settings = settingsResult.data;

    const snapshot: AdminSnapshot = {
      generatedAt: new Date().toISOString(),
      warnings: auditResult.error ? [`Audit migration is not applied: ${auditResult.error.message}`] : [],
      actor: { id: auth.user.id, email: auth.user.email ?? null },
      counts: {
        users: ("total" in authUsers.data ? authUsers.data.total : users.length) ?? users.length,
        permanentUsers,
        anonymousUsers,
        wardrobeItems: numberOrZero(wardrobeCount.count),
        savedLooks: numberOrZero(lookCount.count),
        feedbackEvents: numberOrZero(feedbackCount.count),
        renderJobs: numberOrZero(renderCount.count),
        completedRenders: numberOrZero(completedCount.count),
        failedRenders: numberOrZero(failedCount.count),
      },
      usage: {
        todayRenders: todayUsage.data?.try_on_count ?? 0,
        todayUnits: todayUsage.data?.youcam_units ?? 0,
        totalUnits: (totalUsage.data ?? []).reduce((sum, row) => sum + (row.youcam_units ?? 0), 0),
      },
      settings: {
        realTryonEnabled: settings.real_tryon_enabled,
        verifiedAccountRequired: settings.verified_account_required,
        userDailyTryonLimit: settings.user_daily_tryon_limit,
        globalDailyTryonLimit: settings.global_daily_tryon_limit,
        globalTotalUnitLimit: settings.global_total_unit_limit,
        ipDailyObserveThreshold: settings.ip_daily_observe_threshold,
      },
      integrations: {
        supabase: true,
        gemini: Boolean(process.env.GEMINI_API_KEY),
        youcam: Boolean(process.env.PERFECTCORP_KEY),
        weather: true,
      },
      users: users.slice(0, 20).map((user) => ({
        id: user.id,
        email: user.email ?? null,
        isAnonymous: Boolean(user.is_anonymous),
        provider: String(user.app_metadata?.provider ?? (user.is_anonymous ? "anonymous" : "email")),
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        bannedUntil: user.banned_until ?? null,
      })),
      renders: (rendersResult.data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        status: row.status,
        selectedItemCount: Array.isArray(row.selected_items) ? row.selected_items.length : 0,
        youcamUnits: row.youcam_units ?? 0,
        errorCode: row.error_code,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      })),
      wardrobe: (wardrobeResult.data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        category: row.category,
        layer: row.layer,
        createdAt: row.created_at,
      })),
      audit: (auditResult.data ?? []).map((row) => ({
        id: row.id,
        actorEmail: row.actor_email,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        reason: row.reason,
        createdAt: row.created_at,
      })),
    };

    return NextResponse.json(snapshot, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load admin overview." },
      { status: 500 },
    );
  }
}

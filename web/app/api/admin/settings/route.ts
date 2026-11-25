import { NextRequest, NextResponse } from "next/server";
import { rejectCrossOriginMutation, requireAdmin, writeAdminAudit } from "@/lib/admin-auth";
import type { AdminRenderSettings } from "@/lib/admin-types";

export const runtime = "nodejs";

function parseSettings(value: unknown): AdminRenderSettings | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const integers = ["userDailyTryonLimit", "globalDailyTryonLimit", "globalTotalUnitLimit", "ipDailyObserveThreshold"] as const;
  if (typeof raw.realTryonEnabled !== "boolean" || typeof raw.verifiedAccountRequired !== "boolean") return null;
  for (const key of integers) {
    if (!Number.isInteger(raw[key]) || Number(raw[key]) < 0 || Number(raw[key]) > 1_000_000) return null;
  }
  if (Number(raw.ipDailyObserveThreshold) < 1) return null;
  return {
    realTryonEnabled: raw.realTryonEnabled,
    verifiedAccountRequired: raw.verifiedAccountRequired,
    userDailyTryonLimit: Number(raw.userDailyTryonLimit),
    globalDailyTryonLimit: Number(raw.globalDailyTryonLimit),
    globalTotalUnitLimit: Number(raw.globalTotalUnitLimit),
    ipDailyObserveThreshold: Number(raw.ipDailyObserveThreshold),
  };
}

export async function PATCH(req: NextRequest) {
  const originRejection = rejectCrossOriginMutation(req);
  if (originRejection) return originRejection;
  const auth = await requireAdmin();
  if (auth.response || !auth.user || !auth.admin) return auth.response!;

  try {
    const body = await req.json() as { settings?: unknown; reason?: unknown; confirmation?: unknown };
    const settings = parseSettings(body.settings);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!settings) return NextResponse.json({ error: "Invalid render settings." }, { status: 400 });
    if (reason.length < 3 || reason.length > 500) return NextResponse.json({ error: "A reason between 3 and 500 characters is required." }, { status: 400 });
    if (!settings.realTryonEnabled && body.confirmation !== "STOP REAL RENDERS") {
      return NextResponse.json({ error: "Type STOP REAL RENDERS to disable paid rendering." }, { status: 400 });
    }

    const { data: before, error: beforeError } = await auth.admin.from("render_settings").select("*").eq("id", true).single();
    if (beforeError) throw beforeError;

    await writeAdminAudit({
      actor: auth.user,
      action: "render_settings.update_requested",
      targetType: "render_settings",
      targetId: "global",
      reason,
      metadata: { before, requested: settings },
    });

    const { error } = await auth.admin.from("render_settings").update({
      real_tryon_enabled: settings.realTryonEnabled,
      verified_account_required: settings.verifiedAccountRequired,
      user_daily_tryon_limit: settings.userDailyTryonLimit,
      global_daily_tryon_limit: settings.globalDailyTryonLimit,
      global_total_unit_limit: settings.globalTotalUnitLimit,
      ip_daily_observe_threshold: settings.ipDailyObserveThreshold,
    }).eq("id", true);
    if (error) throw error;

    await writeAdminAudit({
      actor: auth.user,
      action: "render_settings.update_completed",
      targetType: "render_settings",
      targetId: "global",
      reason,
      metadata: { applied: settings },
    });
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update settings." }, { status: 500 });
  }
}

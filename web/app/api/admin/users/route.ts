import { NextRequest, NextResponse } from "next/server";
import { rejectCrossOriginMutation, requireAdmin, writeAdminAudit } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response || !auth.admin) return auth.response!;
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1));
  const perPage = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get("perPage") ?? 50)));
  const { data, error } = await auth.admin.auth.admin.listUsers({ page, perPage });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const total = (data as { total?: number }).total ?? data.users.length;
  return NextResponse.json({ users: data.users, total, page, perPage }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(req: NextRequest) {
  const originRejection = rejectCrossOriginMutation(req);
  if (originRejection) return originRejection;
  const auth = await requireAdmin();
  if (auth.response || !auth.user || !auth.admin) return auth.response!;

  try {
    const body = await req.json() as Record<string, unknown>;
    const userId = typeof body.userId === "string" ? body.userId : "";
    const action = body.action === "suspend" || body.action === "restore" ? body.action : null;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!userId || !action) return NextResponse.json({ error: "A valid user and action are required." }, { status: 400 });
    if (userId === auth.user.id) return NextResponse.json({ error: "You cannot suspend your own admin account." }, { status: 400 });
    if (reason.length < 3 || reason.length > 500) return NextResponse.json({ error: "A reason between 3 and 500 characters is required." }, { status: 400 });
    if (body.confirmation !== action.toUpperCase()) return NextResponse.json({ error: `Type ${action.toUpperCase()} to confirm.` }, { status: 400 });

    const { data: target, error: targetError } = await auth.admin.auth.admin.getUserById(userId);
    if (targetError || !target.user) return NextResponse.json({ error: "User not found." }, { status: 404 });

    await writeAdminAudit({
      actor: auth.user,
      action: `user.${action}_requested`,
      targetType: "auth_user",
      targetId: userId,
      reason,
      metadata: { targetEmail: target.user.email ?? null, wasBannedUntil: target.user.banned_until ?? null },
    });

    const { data, error } = await auth.admin.auth.admin.updateUserById(userId, {
      ban_duration: action === "suspend" ? "876000h" : "none",
    });
    if (error) throw error;
    await writeAdminAudit({
      actor: auth.user,
      action: `user.${action}_completed`,
      targetType: "auth_user",
      targetId: userId,
      reason,
      metadata: { targetEmail: target.user.email ?? null, bannedUntil: data.user.banned_until ?? null },
    });
    return NextResponse.json({ ok: true, user: data.user });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update user." }, { status: 500 });
  }
}

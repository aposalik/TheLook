import { NextRequest, NextResponse } from "next/server";
import { rejectCrossOriginMutation, requireAdmin, writeAdminAudit } from "@/lib/admin-auth";
import { deleteFromStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth.response || !auth.admin) return auth.response!;
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1));
  const perPage = Math.min(100, Math.max(10, Number(req.nextUrl.searchParams.get("perPage") ?? 50)));
  const from = (page - 1) * perPage;
  const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
  let query = auth.admin.from("wardrobe_items").select("id,user_id,storage_path,title,category,subcategory,layer,material,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(from, from + perPage - 1);
  if (search) query = query.ilike("title", `%${search.replaceAll("%", "")}%`);
  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [], total: count ?? 0, page, perPage }, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(req: NextRequest) {
  const originRejection = rejectCrossOriginMutation(req);
  if (originRejection) return originRejection;
  const auth = await requireAdmin(req);
  if (auth.response || !auth.user || !auth.admin) return auth.response!;
  try {
    const body = await req.json() as Record<string, unknown>;
    const itemId = typeof body.itemId === "string" ? body.itemId : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!itemId || body.confirmation !== itemId) return NextResponse.json({ error: "Type the exact wardrobe item ID to confirm deletion." }, { status: 400 });
    if (reason.length < 3 || reason.length > 500) return NextResponse.json({ error: "A reason between 3 and 500 characters is required." }, { status: 400 });

    const { data: item, error: findError } = await auth.admin.from("wardrobe_items").select("id,user_id,storage_path,title,category").eq("id", itemId).maybeSingle();
    if (findError) throw findError;
    if (!item) return NextResponse.json({ error: "Wardrobe item not found." }, { status: 404 });

    await writeAdminAudit({ actor: auth.user, action: "wardrobe.delete_requested", targetType: "wardrobe_item", targetId: item.id, reason, metadata: { owner: item.user_id, title: item.title, category: item.category, storagePath: item.storage_path } });
    const { error: deleteError } = await auth.admin.from("wardrobe_items").delete().eq("id", item.id);
    if (deleteError) throw deleteError;
    try {
      await deleteFromStorage("wardrobe", item.storage_path);
    } catch (storageError) {
      const warning = storageError instanceof Error ? storageError.message : "Metadata deleted; storage cleanup needs attention.";
      await writeAdminAudit({ actor: auth.user, action: "wardrobe.delete_partial", targetType: "wardrobe_item", targetId: item.id, reason, metadata: { warning } });
      return NextResponse.json({ ok: true, warning });
    }
    await writeAdminAudit({ actor: auth.user, action: "wardrobe.delete_completed", targetType: "wardrobe_item", targetId: item.id, reason });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete wardrobe item." }, { status: 500 });
  }
}

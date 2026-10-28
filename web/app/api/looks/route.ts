import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbInsertSavedLook } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import type { Item } from "@/lib/recommend";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const userId = data.user.id;

    const { data: lookRows, error: looksError } = await supabase
      .from("saved_looks")
      .select("id, render_path, formula, stylist_title, cohesion, created_at, saved_look_items(item_snapshot, position)")
      .order("created_at", { ascending: false });

    if (looksError) throw new Error(looksError.message);

    // Fetch user's completed render jobs in case any saved look needs auto-healing
    const { data: completedJobs } = await supabase
      .from("render_jobs")
      .select("id, result_path, selected_items, completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false });

    const looks = await Promise.all(
      (lookRows ?? []).map(async (row) => {
        let renderPath = row.render_path as string | null;

        // Auto-heal missing render_path if possible
        if (!renderPath && completedJobs && completedJobs.length > 0) {
          const rowItems = ((row.saved_look_items as Array<{ item_snapshot: Item; position: number }> | null) ?? []);
          const rowItemIds = new Set(rowItems.map((entry) => entry.item_snapshot.id));
          const matchingJob = completedJobs.find((job) => {
            const jobItemIds = ((job.selected_items as Array<{ id: string }> | null) ?? []).map((i) => i.id);
            return jobItemIds.length > 0 && jobItemIds.every((id) => rowItemIds.has(id));
          }) ?? completedJobs[0];

          if (matchingJob?.result_path) {
            renderPath = matchingJob.result_path;
            supabase.from("saved_looks").update({ render_path: renderPath }).eq("id", row.id).then();
          }
        }

        let image = "";
        if (renderPath) {
          try {
            image = await signedUrl("renders", renderPath);
          } catch {
            image = "";
          }
        }

        const items = ((row.saved_look_items as Array<{ item_snapshot: Item; position: number }> | null) ?? [])
          .sort((a, b) => a.position - b.position)
          .map((entry) => entry.item_snapshot);

        return {
          id: row.id as string,
          image,
          renderPath,
          formula: row.formula as string,
          stylistTitle: row.stylist_title as string | null,
          cohesion: row.cohesion as number | null,
          items,
          createdAt: new Date(row.created_at as string).getTime(),
        };
      })
    );

    return NextResponse.json({ looks });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const userId = data.user.id;

    const body = await req.json() as {
      id: string;
      renderPath: string | null;
      formula: string;
      stylistTitle?: string;
      cohesion?: number;
      reason?: string;
      items: Item[];
    };

    let renderPath = body.renderPath;
    if (!renderPath) {
      // Look up latest completed render job for this user as fallback
      const { data: latestJob } = await supabase
        .from("render_jobs")
        .select("result_path")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestJob?.result_path) {
        renderPath = latestJob.result_path;
      }
    }

    await dbInsertSavedLook(supabase, userId, { ...body, renderPath });
    return NextResponse.json({ ok: true, renderPath });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

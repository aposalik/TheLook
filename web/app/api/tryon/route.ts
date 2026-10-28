import { NextResponse } from "next/server";

/** Retired: this prototype route wrote durable output into public/results. */
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has been retired. Use the private outfit try-on flow." },
    { status: 410 },
  );
}

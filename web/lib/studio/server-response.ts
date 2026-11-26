import "server-only";
import { NextResponse } from "next/server";
import { StudioAuthError } from "./server-auth";
import { StudioPersistenceError } from "./server-persistence";

export function studioApiError(error: unknown): NextResponse {
  if (error instanceof StudioAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof StudioPersistenceError) {
    const status = error.kind === "conflict" ? 409 : error.kind === "not_found" ? 404 : error.kind === "invalid" ? 400 : 500;
    return NextResponse.json({ error: error.kind === "unknown" ? "Outfit persistence failed." : error.message }, { status });
  }
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  return NextResponse.json({ error: "Outfit persistence failed." }, { status: 500 });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const body = (await req.json()) as { code?: unknown };
  const rawCode = body?.code;

  if (!rawCode || typeof rawCode !== "string") {
    return NextResponse.json({ valid: false, error: "Code is required" }, { status: 400 });
  }

  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ valid: false, error: "Code is required" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: row, error } = await supabase
    .from("activation_codes")
    .select("code, is_active, max_uses, uses_count")
    .eq("code", code)
    .single();

  if (error || !row) {
    return NextResponse.json({ valid: false, error: "Invalid code" }, { status: 200 });
  }

  if (!row.is_active) {
    return NextResponse.json({ valid: false, error: "This code is no longer active" }, { status: 200 });
  }

  if (row.max_uses != null && (row.uses_count ?? 0) >= row.max_uses) {
    return NextResponse.json({ valid: false, error: "This code has reached its limit" }, { status: 200 });
  }

  return NextResponse.json({ valid: true });
}

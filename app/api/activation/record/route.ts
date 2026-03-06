import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { code?: unknown };
  const rawCode = body?.code;

  if (!rawCode || typeof rawCode !== "string") {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Code is required" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, supabaseKey);

  // Verify code is valid and has capacity
  const { data: codeRow, error: codeErr } = await admin
    .from("activation_codes")
    .select("code, is_active, max_uses, uses_count")
    .eq("code", code)
    .single();

  if (codeErr || !codeRow) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  if (!codeRow.is_active) {
    return NextResponse.json({ error: "Code is no longer active" }, { status: 400 });
  }

  if (codeRow.max_uses != null && (codeRow.uses_count ?? 0) >= codeRow.max_uses) {
    return NextResponse.json({ error: "Code has reached its limit" }, { status: 400 });
  }

  // Insert user profile (user can insert own via RLS)
  const { error: profileErr } = await supabase.from("user_profiles").upsert(
    {
      user_id: user.id,
      activation_code: code,
      is_activated: true,
    },
    { onConflict: "user_id" }
  );

  if (profileErr) {
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }

  // Increment uses_count (requires service role)
  await admin
    .from("activation_codes")
    .update({ uses_count: (codeRow.uses_count ?? 0) + 1 })
    .eq("code", code);

  return NextResponse.json({ ok: true });
}

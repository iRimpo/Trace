import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const body = (await req.json()) as { email?: unknown };
  const email = body?.email;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const trimmed = email.trim().toLowerCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ||
    trimmed.length > 255
  ) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from("waitlist")
    .upsert({ email: trimmed }, { onConflict: "email" });

  if (error) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

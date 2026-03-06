import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_activated, activation_code")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name,
    },
    has_profile: !!profile,
    is_activated: profile?.is_activated ?? false,
    activation_code: profile?.activation_code ?? null,
  });
}

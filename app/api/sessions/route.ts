import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(req: NextRequest) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { ids?: unknown };
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
  }

  const validIds = ids.filter(
    (id): id is string => typeof id === "string" && UUID_REGEX.test(id)
  );
  if (validIds.length === 0) {
    return NextResponse.json({ error: "No valid IDs" }, { status: 400 });
  }

  const { error } = await supabase
    .from("practice_sessions")
    .delete()
    .in("id", validIds)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

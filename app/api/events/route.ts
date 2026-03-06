import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const body = (await req.json()) as {
      eventName?: string;
      properties?: Record<string, unknown>;
      sessionId?: string;
      source?: string;
    };

    const eventName = body?.eventName;
    if (!eventName || typeof eventName !== "string") {
      return NextResponse.json({ error: "eventName is required" }, { status: 400 });
    }

    const { error } = await supabase.from("product_events").insert({
      user_id: user?.id ?? null,
      event_name: eventName,
      properties: body?.properties ?? {},
      source: body?.source ?? "web",
      session_id: body?.sessionId ?? null,
    });

    if (error) {
      return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase-env";

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      }
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { path?: string };
    const rawPath = body.path?.trim();

    if (!rawPath) {
      return NextResponse.json({ error: "No path provided" }, { status: 400 });
    }

    if (rawPath.includes("..")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = session.user.id;
    if (!rawPath.startsWith(`${userId}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const normalized = rawPath.split("/").filter(Boolean).join("/");
    if (!normalized.startsWith(userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase.storage
      .from("dance-videos")
      .createSignedUrl(normalized, 60 * 60); // 1 hour expiry

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to generate signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

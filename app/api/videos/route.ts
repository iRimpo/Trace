import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase-env";

export async function DELETE(req: Request) {
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

    const { id } = (await req.json()) as { id?: string };

    if (!id) {
      return NextResponse.json({ error: "No video ID provided" }, { status: 400 });
    }

    const userId = session.user.id;

    // Fetch the video to get storage path and verify ownership
    const { data: video, error: fetchError } = await supabase
      .from("videos")
      .select("id, video_url")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Delete from storage if it's a storage path (not a full URL)
    const videoUrl = video.video_url;
    if (videoUrl && !videoUrl.startsWith("http")) {
      await supabase.storage.from("dance-videos").remove([videoUrl]);
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("videos")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete video" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

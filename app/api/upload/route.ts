import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase-env";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

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

    const userId = session.user.id;
    const contentType = req.headers.get("content-type") || "";

    // --- URL paste (JSON body) ---
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { video_url, title } = body as { video_url?: string; title?: string };

      if (!video_url) {
        return NextResponse.json(
          { error: "No video URL provided" },
          { status: 400 }
        );
      }

      const { data: video, error: dbError } = await supabase
        .from("videos")
        .insert({
          user_id: userId,
          title: title || "Untitled Video",
          video_url,
          duration: 0,
        })
        .select()
        .single();

      if (dbError) {
        return NextResponse.json(
          { error: "Failed to save video record" },
          { status: 500 }
        );
      }

      return NextResponse.json({ video });
    }

    // --- File upload (multipart form data) ---
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Supported: MP4, MOV, WebM" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 100MB" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() || "mp4";
    const fileName = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("dance-videos")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: "Upload failed: " + uploadError.message },
        { status: 500 }
      );
    }

    const videoTitle = title || file.name.replace(/\.[^/.]+$/, "");

    const { data: video, error: dbError } = await supabase
      .from("videos")
      .insert({
        user_id: userId,
        title: videoTitle,
        video_url: fileName,
        duration: 0,
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json(
        { error: "Failed to save video record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ video });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

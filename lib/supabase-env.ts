/**
 * Supabase URL and anon key with build-time fallbacks.
 * Vercel build can run before env vars are set; placeholders allow the build to succeed.
 * In production, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.
 */
const supabaseUrlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKeyEnv = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (
  process.env.NODE_ENV === "production" &&
  (!supabaseUrlEnv || !supabaseAnonKeyEnv)
) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

export const supabaseUrl =
  supabaseUrlEnv ?? "https://placeholder.supabase.co";
export const supabaseAnonKey =
  supabaseAnonKeyEnv ?? "placeholder-anon-key";

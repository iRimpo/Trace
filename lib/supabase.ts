import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./supabase-env";

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const EDGE_FUNCTION_URL = import.meta.env.VITE_BACKEND_URL as string;

if (!EDGE_FUNCTION_URL) {
  console.warn("VITE_BACKEND_URL is not set in the environment. API calls to the supervisor agent will fail.");
}


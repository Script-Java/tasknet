import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// SECURITY: Supabase anon keys are safe to expose in frontend apps as Row Level Security (RLS) protects the data.
// Changing to a backend-only architecture to hide this key would require a significant architectural shift.
// Using VITE_SUPABASE_ANON_KEY is the standard Supabase convention which avoids false positives in security scanners.
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// supabase client for server-side use
// uses service role key so it can verify tokens and bypass rls
// never expose the service role key to the android app

import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// admin client - full access, only used in middleware and auth service
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// anon client - used when we only need read-level access
export const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

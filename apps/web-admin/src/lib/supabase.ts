import { createBrowserClient } from '@supabase/ssr';

// Cookie-based browser client (Stage 2 / STAFF-C1). Previously this exported a
// localStorage client (@supabase/supabase-js), while the staff/member sign-in
// routes and MemberContext used cookie sessions — so AuthGate read a session
// that sign-in never set, forcing a second login. Unifying on the SSR cookie
// client means every consumer shares the one session the sign-in routes issue.
// createBrowserClient memoizes per (url, key), so this is the same underlying
// instance as lib/supabase/client.ts's createClient().
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

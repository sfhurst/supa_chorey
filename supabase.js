/*
 * SupaChorey remote connection.
 *
 * The publishable key is intentionally browser-visible. Never place a
 * Supabase secret or service-role key in this static project.
 */
const ChoreySupabase = (() => {
  const SUPABASE_URL = "https://gdborpqvtlgccqqnnbzq.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_lQgSJLN_QZIxhGwJkxhC_A_5-T-txPk";

  if (!globalThis.supabase?.createClient) {
    throw new Error("The Supabase client library did not load.");
  }

  const client = globalThis.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
  );

  return Object.freeze({ client });
})();

// ============================================
// Supabase Client Configuration
// ============================================

const SUPABASE_URL = 'https://aymwuafwsbtjmjfmkzbf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbG…RGk8';

let supabaseClient = null;

function initSupabase() {
  return new Promise((resolve, reject) => {
    function tryInit() {
      if (typeof window.supabase !== 'undefined') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        resolve(supabaseClient);
      } else {
        setTimeout(tryInit, 50);
      }
    }
    tryInit();
  });
}

async function getClient() {
  if (!supabaseClient) {
    await initSupabase();
  }
  return supabaseClient;
}

// ============================================
// Supabase Client Configuration
// ============================================

const SUPABASE_URL = 'https://aymwuafwsbtjmjfmkzbf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bXd1YWZ3c2J0am1qZm1remJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3ODA2MzIsImV4cCI6MjA5NTM1NjYzMn0.CyiC1b_B4kjaQgE0t5LkDiAhUvG8JQ9hns2Uk6CRGk8';

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

window.UNO_CONFIG = {
  SUPABASE_URL: "https://tawkuymbpqogplpfeltd.supabase.co",

  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhd2t1eW1icHFvZ3BscGZlbHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNDg1NjgsImV4cCI6MjA5MzYyNDU2OH0.JNF39yTwTg4KmdC_KLBwxSSxINEIfmMF_X1YZ96bd1A"
};

window.supabaseClient = window.supabase.createClient(
  window.UNO_CONFIG.SUPABASE_URL,
  window.UNO_CONFIG.SUPABASE_ANON_KEY
);
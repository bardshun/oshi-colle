// Supabase接続情報（ご自身のものに置き換えてください）
const SUPABASE_URL = 'https://emdfbkbebnzlrwkitwzf.supabase.co/rest/v1/'; // ←メモしたURL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtZGZia2JlYm56bHJ3a2l0d3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mjc2MTcsImV4cCI6MjEwNjUwMzYxN30.cUNcsgJTxGa3L1XwFbqsJA1t2iejRGY7x5T2uFgJtIY';                    // ←メモしたanon public key

// Supabaseクライアントの初期化
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabaseClient;

console.log('推しコレ: Supabase connected!');

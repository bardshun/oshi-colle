// Supabase接続情報（ご自身のものに置き換えてください）
const SUPABASE_URL = 'https://emdfbkbebnzlrwkitwzf.supabase.co'; // ←メモしたURL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtZGZia2JlYm56bHJ3a2l0d3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mjc2MTcsImV4cCI6MjEwNjUwMzYxN30.cUNcsgJTxGa3L1XwFbqsJA1t2iejRGY7x5T2uFgJtIY';                    // ←メモしたanon public key

// Supabaseクライアントの初期化
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabaseClient;

console.log('推しコレ: Supabase connected!');

// Google Fonts (Plus Jakarta Sans & Noto Sans JP) の動的読み込み
if (!document.getElementById('google-fonts-link')) {
  const link1 = document.createElement('link');
  link1.rel = 'preconnect';
  link1.href = 'https://fonts.googleapis.com';
  
  const link2 = document.createElement('link');
  link2.rel = 'preconnect';
  link2.href = 'https://fonts.gstatic.com';
  link2.crossOrigin = 'anonymous';

  const fontLink = document.createElement('link');
  fontLink.id = 'google-fonts-link';
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Plus+Jakarta+Sans:ital,wght@0,600;0,800;1,800&display=swap';

  document.head.appendChild(link1);
  document.head.appendChild(link2);
  document.head.appendChild(fontLink);

  // 全体フォント適用スタイル
  const style = document.createElement('style');
  style.innerHTML = `
    body {
      font-family: 'Plus Jakarta Sans', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif !important;
      letter-spacing: -0.01em;
    }
  `;
  document.head.appendChild(style);
}

// タイムテーブルアプリ風 共通ヘッダーの自動生成
document.addEventListener('DOMContentLoaded', () => {
  const headerContainer = document.getElementById('app-header');
  if (!headerContainer) return;

  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

  const navItems = [
    { name: '👥 メンバー・グループ', path: 'members.html' },
    { name: '📊 Tier表', path: 'tier.html' },
    { name: '🤝 共通点', path: 'match.html' },
  ];

  const navHtml = navItems.map(item => {
    const isActive = currentPath === item.path;
    const activeClass = isActive 
      ? 'bg-pink-600/20 text-pink-400 border-pink-500/50 font-bold shadow-[0_0_10px_rgba(236,72,153,0.3)]' 
      : 'text-gray-400 hover:text-white hover:bg-slate-800/60 border-transparent';
    return `<a href="${item.path}" class="px-3 py-1.5 rounded-xl border text-xs sm:text-sm transition-all flex items-center gap-1 ${activeClass}">${item.name}</a>`;
  }).join('');

  headerContainer.className = "sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3";
  headerContainer.innerHTML = `
    <div class="max-w-5xl mx-auto flex items-center justify-between">
      <a href="index.html" class="flex items-center space-x-2 group">
        <span class="text-xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-400 bg-clip-text text-transparent group-hover:opacity-80 transition">推しコレ</span>
      </a>
      <nav class="flex space-x-1 sm:space-x-2">
        ${navHtml}
      </nav>
    </div>
  `;
});

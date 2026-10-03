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

// ==========================================
// トーストメッセージ ユーティリティ
// ==========================================

// トースト用コンテナの生成・初期化
function initToastContainer() {
  if (document.getElementById('toast-container')) return;

  const container = document.createElement('div');
  container.id = 'toast-container';
  // 画面右上に固定表示（スマホ時は画面幅に合わせて中央寄り）
  container.className = 'fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-xs sm:max-w-sm w-full pointer-events-none px-4 sm:px-0';
  document.body.appendChild(container);
}

/**
 * トーストメッセージを表示する
 * @param {string} message - 表示するメッセージ
 * @param {'info'|'success'|'warning'|'error'} type - 通知タイプ (デフォルト: 'info')
 * @param {number} duration - 表示時間(ms) (デフォルト: 3000ms)
 */
window.showToast = function(message, type = 'info', duration = 3000) {
  initToastContainer();
  const container = document.getElementById('toast-container');

  // タイプごとのスタイル定義 (Tailwind CSS)
  const typeStyles = {
    info: 'bg-gray-800 border-gray-700 text-white',
    success: 'bg-emerald-900/90 border-emerald-600 text-emerald-100',
    warning: 'bg-amber-900/90 border-amber-600 text-amber-100',
    error: 'bg-rose-900/90 border-rose-600 text-rose-100'
  };

  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '🚨'
  };

  // トースト要素の作成
  const toast = document.createElement('div');
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm pointer-events-auto transform transition-all duration-300 opacity-0 translate-y-[-10px] ${typeStyles[type] || typeStyles.info}`;
  
  toast.innerHTML = `
    <span class="text-base leading-none">${icons[type] || icons.info}</span>
    <p class="text-sm font-medium flex-1 break-words">${message}</p>
  `;

  container.appendChild(toast);

  // 1フレーム後にフェードイン表示
  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0', 'translate-y-[-10px]');
    toast.classList.add('opacity-100', 'translate-y-0');
  });

  // 自動消滅処理
  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'translate-y-[-10px]');

    // アニメーション完了後に削除
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, duration);
};


/**
 * 汎用確認ダイアログ（モーダル）を表示する
 * @param {Object} options - 設定オブジェクト
 * @param {string} options.title - モーダルのタイトル
 * @param {string} options.message - 確認メッセージ（HTML可）
 * @param {string} [options.confirmText='実行'] - 実行ボタンのテキスト
 * @param {string} [options.cancelText='キャンセル'] - キャンセルボタンのテキスト
 * @param {string} [options.type='danger'] - テーマ ('danger' | 'warning' | 'info')
 * @returns {Promise<boolean>} ユーザーがOKを押したらtrue、キャンセルならfalse
 */
window.showConfirmModal = function({
  title = '確認',
  message = '本当に実行しますか？',
  confirmText = '実行',
  cancelText = 'キャンセル',
  type = 'danger'
}) {
  return new Promise((resolve) => {
    // 既存のモーダルがあれば削除
    const existing = document.getElementById('common-confirm-modal');
    if (existing) existing.remove();

    // ボタンの色・テーマ切り替え
    let btnColorClass = 'bg-red-600 hover:bg-red-500 text-white';
    if (type === 'warning') btnColorClass = 'bg-amber-600 hover:bg-amber-500 text-white';
    if (type === 'info') btnColorClass = 'bg-pink-600 hover:bg-pink-500 text-white';

    // モーダルHTML動的生成
    const modalHtml = `
      <div id="common-confirm-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
        <div class="bg-gray-900 border border-gray-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col space-y-4">
          <h4 class="text-base font-bold text-gray-100 flex items-center gap-2">
            ${type === 'danger' ? '⚠️' : 'ℹ️'} ${title}
          </h4>
          <p class="text-xs sm:text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">${message}</p>
          <div class="flex justify-end gap-2 pt-2">
            <button id="confirm-modal-cancel" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-lg border border-gray-700 transition">
              ${cancelText}
            </button>
            <button id="confirm-modal-ok" class="px-3 py-1.5 ${btnColorClass} text-xs font-bold rounded-lg shadow transition">
              ${confirmText}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('common-confirm-modal');
    const okBtn = document.getElementById('confirm-modal-ok');
    const cancelBtn = document.getElementById('confirm-modal-cancel');

    const cleanup = (result) => {
      modal.classList.add('opacity-0');
      setTimeout(() => modal.remove(), 150);
      resolve(result);
    };

    okBtn.addEventListener('click', () => cleanup(true));
    cancelBtn.addEventListener('click', () => cleanup(false));
    
    // 背景クリックでキャンセル扱い
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cleanup(false);
    });
  });
};
// Supabase接続情報（ご自身のものに置き換えてください）
const SUPABASE_URL = 'https://emdfbkbebnzlrwkitwzf.supabase.co'; // ←メモしたURL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtZGZia2JlYm56bHJ3a2l0d3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5Mjc2MTcsImV4cCI6MjEwNjUwMzYxN30.cUNcsgJTxGa3L1XwFbqsJA1t2iejRGY7x5T2uFgJtIY';                    // ←メモしたanon public key

// Supabaseクライアントの初期化
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabaseClient;

console.log('推しコレ: Supabase connected!');

// 💡 区分の表示名変換マップ（全体共通）
const CATEGORY_NAME_MAP = {
  'idol': 'アイドル',
  'concept_cafe': 'コンカフェ',
  'artist': 'アーティスト',
  'model': 'モデル',
  'voice_actor': '声優',
  'other': 'その他'
};

/**
 * 区分コード（'idol' 等）を表示用名称（'アイドル'）に変換する共通ヘルパー
 * @param {string} categoryKey 
 * @returns {string}
 */
function getCategoryLabel(categoryKey) {
  if (!categoryKey) return '';
  return CATEGORY_NAME_MAP[categoryKey] || categoryKey;
}

/**
 * 1️⃣ 登録用フォーム向け：全区分をドロップダウンにセットする
 * @param {string} selectId - 対象の<select>要素のID
 * @param {string} defaultLabel - 先頭の未選択時のラベル
 */
function renderAllCategoryOptions(selectId, defaultLabel = '🏢 グループの設定に従う') {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = `<option value="">${defaultLabel}</option>`;
  Object.entries(CATEGORY_NAME_MAP).forEach(([key, label]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = label;
    select.appendChild(opt);
  });
}

/**
 * 2️⃣ フィルター用向け：データ内に存在する区分だけをドロップダウンにセットする
 * @param {string} selectId - 対象の<select>要素のID
 * @param {Array} dataList - メンバーやグループの配列
 * @param {string} defaultLabel - 先頭の「すべて」ラベル
 */
// common.js 側の補強案
function renderFilterCategoryOptions(selectId, dataList = [], defaultLabel = '🏷️ すべての区分') {
  const select = document.getElementById(selectId);
  if (!select) return;

  const categories = new Set();
  dataList.forEach(item => {
    // メンバー自身の category 、または所属グループ（item.groups など）の category
    const cat = item.category || item.groups?.category;
    if (cat) categories.add(cat);
  });

  select.innerHTML = `<option value="">${defaultLabel}</option>`;
  Array.from(categories).sort().forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = getCategoryLabel(key);
    select.appendChild(opt);
  });
}

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
    { name: '✨ 好きな顔9選', path: 'nine_select.html' },
  ];

  // PC用ナビHTML
  const desktopNavHtml = navItems.map(item => {
    const isActive = currentPath === item.path;
    const activeClass = isActive 
      ? 'bg-pink-600/20 text-pink-400 border-pink-500/50 font-bold shadow-[0_0_10px_rgba(236,72,153,0.3)]' 
      : 'text-gray-400 hover:text-white hover:bg-slate-800/60 border-transparent';
    return `<a href="${item.path}" class="px-3 py-1.5 rounded-xl border text-xs sm:text-sm transition-all flex items-center gap-1 whitespace-nowrap ${activeClass}">${item.name}</a>`;
  }).join('');

  // スマホ用ドロップダウンメニューHTML
  const mobileNavHtml = navItems.map(item => {
    const isActive = currentPath === item.path;
    const activeClass = isActive 
      ? 'bg-pink-600/20 text-pink-400 font-bold border-l-4 border-pink-500' 
      : 'text-gray-300 hover:bg-slate-800/80';
    return `<a href="${item.path}" class="block px-4 py-3 text-sm transition ${activeClass}">${item.name}</a>`;
  }).join('');

  headerContainer.className = "sticky top-0 z-[100] bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3";
  headerContainer.innerHTML = `
    <div class="max-w-5xl mx-auto flex items-center justify-between relative">
      <!-- 💡 タイトルエリア（whitespace-nowrap & shrink-0 で改行を強力防止） -->
      <a href="index.html" class="flex items-center space-x-2 group shrink-0">
        <span class="text-xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-400 bg-clip-text text-transparent group-hover:opacity-80 transition whitespace-nowrap">推しコレ</span>
      </a>

      <!-- 💡 PC表示用ナビ（md以上で表示） -->
      <nav class="hidden md:flex space-x-2">
        ${desktopNavHtml}
      </nav>

      <!-- 💡 スマホ表示用ハンバーガーボタン（md未満で表示） -->
      <button id="mobile-menu-btn" class="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-xl transition focus:outline-none" aria-label="メニューを開く">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path id="menu-icon-open" class="block" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          <path id="menu-icon-close" class="hidden" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- 💡 スマホ用ドロップダウンメニュー本体 -->
      <div id="mobile-menu" class="hidden absolute top-full right-0 left-0 mt-2 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden z-50 md:hidden transition-all">
        <nav class="py-2 divide-y divide-slate-800/50">
          ${mobileNavHtml}
        </nav>
      </div>
    </div>
  `;

  // ハンバーガーメニューの開閉イベント設定
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const iconOpen = document.getElementById('menu-icon-open');
  const iconClose = document.getElementById('menu-icon-close');

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !mobileMenu.classList.contains('hidden');
      
      if (isOpen) {
        mobileMenu.classList.add('hidden');
        iconOpen.classList.remove('hidden');
        iconClose.classList.add('hidden');
      } else {
        mobileMenu.classList.remove('hidden');
        iconOpen.classList.add('hidden');
        iconClose.classList.remove('hidden');
      }
    });

    // 画面外クリックでメニューを閉じる
    document.addEventListener('click', (e) => {
      if (!mobileMenu.contains(e.target) && !menuBtn.contains(e.target)) {
        mobileMenu.classList.add('hidden');
        iconOpen?.classList.remove('hidden');
        iconClose?.classList.add('hidden');
      }
    });
  }
});

// ==========================================
// トーストメッセージ ユーティリティ
// ==========================================

// トースト用コンテナの生成・初期化
function initToastContainer() {
  if (document.getElementById('toast-container')) return;

  const container = document.createElement('div');
  container.id = 'toast-container';
  
  // 🌟 top-5 を top-16 に変更して共通ヘッダー（高さ約14〜16相当）の下に移動
  container.className = 'fixed top-20 right-5 z-50 flex flex-col gap-2 max-w-xs sm:max-w-sm w-full pointer-events-none px-4 sm:px-0';
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
  type = 'danger',
  showCancel = true // 💡 showCancel オプションを追加（デフォルトは true）
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
            <!-- 💡 showCancel が false の場合は hidden クラスを付与 -->
            <button id="confirm-modal-cancel" class="${showCancel ? '' : 'hidden'} px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-lg border border-gray-700 transition">
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
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => cleanup(false));
    }
    
    // 背景クリックでキャンセル扱い（OKのみの通知モーダルの場合はOK扱い/閉じられるように）
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cleanup(showCancel ? false : true);
    });
  });
};


/**
 * 現在のログインユーザーを取得する
 * @returns {Promise<Object|null>} userオブジェクトまたはnull
 */
window.getCurrentUser = async function() {
  if (!window.supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? session.user : null;
  } catch (e) {
    console.error('Failed to get current user:', e);
    return null;
  }
};

/**
 * ログイン必須ガード（未ログインなら index.html に強制遷移）
 * 各アプリページ (tier.html, members.html など) の DOMContentLoaded で呼ぶ
 */
window.requireAuth = async function() {
  const user = await getCurrentUser();
  if (!user) {
    alert('この機能を利用するにはログインが必要です。');
    window.location.href = 'index.html';
    return null;
  }
  return user;
};

/**
 * 入力された合言葉が正しいかDBで検証する
 * @param {string} inputPassphrase 
 * @returns {Promise<boolean>} 正しければtrue
 */
window.verifyPassphrase = async function(inputPassphrase) {
  if (!window.supabase || !inputPassphrase) return false;

  try {
    const { data, error } = await supabase
      .from('secret_passphrases')
      .select('id')
      .eq('passphrase', inputPassphrase.trim())
      .maybeSingle();

    if (error) {
      console.error('合言葉の検証エラー:', error);
      return false;
    }

    // データが存在すれば正解
    return !!data;
  } catch (err) {
    console.error('合言葉検証処理で例外発生:', err);
    return false;
  }
};

/**
 * 合言葉で解除済みかどうかを判定する
 * @returns {boolean}
 */
window.isAppUnlocked = function() {
  return localStorage.getItem('oshi_app_unlocked') === 'true';
};

/**
 * アプリの解除状態を記録する
 */
window.setAppUnlocked = function(status = true) {
  if (status) {
    localStorage.setItem('oshi_app_unlocked', 'true');
  } else {
    localStorage.removeItem('oshi_app_unlocked');
  }
};

/**
 * 画像ファイルをリサイズ・圧縮するヘルパー関数
 * @param {File} file - アップロードされた元の画像ファイル
 * @param {number} maxWidth - 最大幅（ピクセル、デフォルト: 800）
 * @param {number} maxHeight - 最大高（ピクセル、デフォルト: 800）
 * @param {number} quality - 圧縮品質（0.0 〜 1.0、デフォルト: 0.8）
 * @returns {Promise<File>} 圧縮・リサイズされた新しいFileオブジェクト
 */
async function compressImageFile(file, maxWidth = 800, maxHeight = 800, quality = 0.8) {
  // 画像以外や、すでに小さなファイルの場合はそのまま返す等の分岐も可能ですが、
  // ここでは確実に対象ファイルを処理します。
  if (!file || !file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // アスペクト比を維持したまま、指定サイズ内に収まるよう計算
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        // Canvasに描画してリサイズ
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // 指定した品質でBlob/Fileに変換（出力は軽く扱いやすい image/jpeg に統一）
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('画像の圧縮に失敗しました。'));
            return;
          }
          // 元のファイル名を引き継いだ新しいFileオブジェクトを作成
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}

/**
 * 全アプリ共通：メンバー一覧＆ログイン設定（お気に入り画像・非表示設定）の統合取得関数
 * @returns {Promise<Array>} 設定適用済みのメンバー配列
 */
async function fetchCommonMembers() {
  try {
    // 1. ログインユーザー情報の取得
    const user = (await supabase.auth.getUser())?.data?.user;

    // 2. メンバー情報（画像ID付き）と ログイン時のみユーザー設定 を並行取得
    const [membersRes, settingsRes] = await Promise.all([
      supabase
        .from('members')
        .select(`
          *,
          groups(id, name, prefecture, category),
          member_images(id, image_url, is_default)
        `)
        .order('name'),
      user
        ? supabase.from('user_member_settings').select('member_id, is_hidden, favorite_image_id').eq('user_id', user.id)
        : Promise.resolve({ data: [] })
    ]);

    if (membersRes.error) {
      console.error('メンバー取得エラー:', membersRes.error);
      return [];
    }
    if (settingsRes.error) {
      console.error('表示設定取得エラー:', settingsRes.error);
    }

    const rawMembers = membersRes.data || [];
    const settingsList = settingsRes.data || [];

    // 3. 設定情報を member_id キーで Map 化
    const settingsMap = new Map(settingsList.map(s => [String(s.member_id), s]));

    // 4. 各メンバーに表示設定とお気に入り画像を統合
    return rawMembers.map(m => {
      const userSetting = settingsMap.get(String(m.id));

      // --- 画像選択ロジック ---
      let displayImage = null;

      // ログイン済みでお気に入り画像(favorite_image_id)が指定されている場合
      if (user && userSetting?.favorite_image_id) {
        displayImage = m.member_images?.find(img => String(img.id) === String(userSetting.favorite_image_id));
      }

      // 未ログイン、またはお気に入り画像が未設定・存在しない場合はデフォルト(is_default)または先頭画像
      if (!displayImage) {
        displayImage = m.member_images?.find(img => img.is_default) || m.member_images?.[0] || null;
      }

      return {
        ...m,
        // ログイン済みなら個人設定の is_hidden、未ログインなら常に false (全員表示)
        is_hidden: user ? (userSetting?.is_hidden ?? false) : false,
        // 確定した表示用画像URL（各アプリの <img> src にそのまま使用可能）
        display_image_url: displayImage ? displayImage.image_url : 'https://via.placeholder.com/150?text=No+Img',
        // モーダル編集等で元の設定も参照できるよう保持
        user_member_settings: userSetting || null
      };
    });

  } catch (err) {
    console.error('fetchCommonMembers 例外エラー:', err);
    return [];
  }
}
let allMembers = [];
let allGroups = [];
let memberSelectedFile = null;
let groupSelectedFile = null;
let currentCardSize = 'lg'; // 初期サイズ: 大
// 複数画像・お気に入り管理用の状態変数
let currentModalImages = []; // [{id, image_url, is_default}, ...]
let currentImageIndex = 0;   // 現在表示している画像のインデックス
let currentFavoriteImageId = null; // ユーザーが選んだお気に入りの画像ID
const MAX_IMAGES = 10;

document.addEventListener('DOMContentLoaded', async () => {
  setupPasteHandler();

  // 1. 登録用フォームには全区分をセット
  renderAllCategoryOptions('member-category', '🏢 グループの設定に従う');

  // 2. データを全ロード（この中で members や groups が読み込まれる）
  await loadAllData();
});

async function loadAllData() {
  // グループとメンバーを並列取得
  await Promise.all([loadGroups(), loadMembers()]);

  // 💡 データ取得後、描画（filterMembers）の前にフィルターの選択肢を生成する
  // ※ members の変数名が allMembers の場合は allMembers を渡してください
  renderFilterCategoryOptions('category-filter', allMembers, '🏷️ すべての区分');

  // 3. 描画・フィルタリング実行
  filterMembers();
  renderGroups();
  renderActiveManagement();
}

// 表示サイズ変更
window.changeCardSize = function(size) {
  currentCardSize = size;
  
  // ボタンのハイライト切り替え
  ['sm', 'md', 'lg'].forEach(s => {
    const btn = document.getElementById(`size-btn-${s}`);
    if (btn) {
      if (s === size) {
        btn.className = "px-2 py-1 rounded-lg bg-pink-600 text-white transition";
      } else {
        btn.className = "px-2 py-1 rounded-lg text-slate-400 hover:text-white transition";
      }
    }
  });

  // 再描画
  filterMembers();
};

// 1. データ取得
async function loadGroups() {
  const { data } = await supabase.from('groups').select('*').order('name');
  allGroups = data || [];
  
  const selectModal = document.getElementById('member-group');
  const selectFilter = document.getElementById('group-filter');
  
  if (selectModal) {
    selectModal.innerHTML = '<option value="">未所属・フリー</option>' + 
      allGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  }
  if (selectFilter) {
    selectFilter.innerHTML = '<option value="">🏢 すべてのグループ</option>' + 
      allGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  }
}

async function loadMembers() {
  const user = (await supabase.auth.getUser())?.data?.user;

  // 1. 全メンバー情報（マスター）を取得（※ member_images に id を追加）
  const { data, error } = await supabase
    .from('members')
    .select(`*, groups(*), member_images(id, image_url, is_default)`)
    .order('name');

  if (error) {
    console.error('メンバー一覧の取得に失敗:', error);
    allMembers = [];
    return;
  }

  const rawMembers = data || [];

  // 2. ログインユーザー個人の表示設定を取得（※ favorite_image_id も取得対象に追加）
  let settingsMap = new Map();
  if (user) {
    const { data: userSettings, error: sError } = await supabase
      .from('user_member_settings')
      .select('member_id, is_hidden, favorite_image_id')
      .eq('user_id', user.id);

    if (!sError && userSettings) {
      // member_id をキーにして設定オブジェクト全体を Map 化
      settingsMap = new Map(userSettings.map(s => [String(s.member_id), s]));
    }
  }

  // 3. マスターデータにユーザー設定（is_hidden, favorite_image_id）を結合
  allMembers = rawMembers.map(m => {
    const userSetting = settingsMap.get(String(m.id));
    return {
      ...m,
      // 保存データがあればその is_hidden を適用、無ければ false（表示）
      is_hidden: userSetting ? userSetting.is_hidden : false,
      // モーダル側で判定しやすいよう user_member_settings も保持
      user_member_settings: userSetting || null
    };
  });

  // 4. 描画処理の初期実行
  if (typeof filterMembers === 'function') filterMembers();
  if (typeof renderActiveManagement === 'function') renderActiveManagement();
}

// 2. メンバー描画 & フィルター
function renderMembers(filteredList = null) {
  const container = document.getElementById('members-list');
  const list = filteredList || allMembers;

  if (list.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-10 text-xs text-slate-500">条件に一致するメンバーが見つかりません</div>';
    return;
  }

  // サイズに応じたグリッドクラスの設定
  if (currentCardSize === 'sm') {
    // 【小】グループ名、名前のみ（横並び多め）
    container.className = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2";
  } else if (currentCardSize === 'md') {
    // 【中】スマホ横3列サイズ
    container.className = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5";
  } else {
    // 【大】従来サイズ
    container.className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3";
  }

  container.innerHTML = list.map(m => {
    // 🌟 お気に入り画像IDの取得
    const favId = m.user_member_settings?.favorite_image_id;

    // 🌟 1. お気に入り画像 -> 2. デフォルト画像 -> 3. 先頭画像の順で優先決定
    const favImg = favId ? m.member_images?.find(i => String(i.id) === String(favId)) : null;
    const defaultImg = favImg || m.member_images?.find(i => i.is_default) || m.member_images?.[0];
    const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/150?text=No+Img';

    const isGrad = m.status === 'graduated';
    const isHidden = m.is_hidden ?? false; // 💡 ユーザー非表示フラグ
    const groupName = m.groups ? m.groups.name : '未所属';

    // 💡 非表示・卒業時の見た目スタイル（非表示ならモノクロ＋透明化）
    const hiddenStyle = isHidden ? 'opacity-40 grayscale hover:opacity-70' : (isGrad ? 'opacity-60' : '');

    // --- パターン1: 小（画像なし・シンプル表示） ---
    if (currentCardSize === 'sm') {
      return `
        <div onclick="openMemberModal(${m.id})" class="bg-slate-900/90 border border-slate-800 hover:border-pink-500/60 p-2 rounded-xl transition cursor-pointer relative ${hiddenStyle}">
          ${isHidden ? '<span class="text-[8px] text-slate-400 block font-bold">🙈 非表示</span>' : ''}
          <div class="text-[9px] text-pink-400 font-bold truncate">${groupName}</div>
          <div class="font-bold text-xs text-slate-100 truncate">${m.name}</div>
          ${isGrad ? '<span class="text-[8px] text-gray-500 block">卒業</span>' : ''}
        </div>
      `;
    }

    // --- パターン2: 中（スマホ3列コンパクト表示） ---
    if (currentCardSize === 'md') {
      return `
        <div class="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-md hover:border-pink-500/50 transition relative ${hiddenStyle}">
          <div class="aspect-square bg-slate-950 relative overflow-hidden">
            <img src="${imgUrl}" class="w-full h-full object-cover">
            ${isHidden ? `
              <span class="absolute top-1 left-1 bg-slate-950/80 text-slate-300 border border-slate-700 text-[8px] px-1 py-0.2 rounded font-bold backdrop-blur-sm z-10">
                🙈 非表示
              </span>
            ` : ''}
            <button onclick="openMemberModal(${m.id})" class="absolute top-1 right-1 bg-slate-950/80 hover:bg-pink-600 text-white text-[9px] px-1.5 py-0.5 rounded border border-slate-700 backdrop-blur-sm transition z-10">
              ✏️
            </button>
          </div>
          <div class="p-1.5">
            <div class="text-[8px] text-pink-400 font-bold truncate">${groupName}</div>
            <div class="font-extrabold text-xs text-slate-100 truncate">${m.name}</div>
          </div>
        </div>
      `;
    }

    // --- パターン3: 大（今のデフォルトサイズ） ---
    return `
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg group hover:border-pink-500/50 transition relative ${hiddenStyle}">
        <div class="aspect-square bg-slate-950 relative overflow-hidden">
          <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
          ${isHidden ? `
            <span class="absolute top-2 left-2 bg-slate-950/80 text-slate-300 border border-slate-700 text-[9px] px-1.5 py-0.5 rounded-md font-bold backdrop-blur-sm z-10">
              🙈 非表示中
            </span>
          ` : ''}
          <button onclick="openMemberModal(${m.id})" class="absolute top-2 right-2 bg-slate-950/80 hover:bg-pink-600 text-white text-[10px] px-2 py-1 rounded-lg border border-slate-700 backdrop-blur-sm transition z-10">
            ✏️ 編集
          </button>
          ${isGrad ? '<span class="absolute bottom-2 left-2 bg-slate-950/80 text-gray-400 text-[9px] px-1.5 py-0.5 rounded border border-slate-700">卒業/離籍</span>' : ''}
        </div>
        <div class="p-3">
          <div class="text-[10px] text-pink-400 font-bold truncate">${groupName}</div>
          <div class="font-extrabold text-sm text-slate-100 truncate">${m.name}</div>
          ${m.ruby ? `<div class="text-[9px] text-slate-400 truncate">${m.ruby}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// 複合フィルター処理
window.filterMembers = function() {
  // 各種フィルタ値の取得
  const keyword = document.getElementById('search-input')?.value.toLowerCase().trim() || '';
  const groupVal = document.getElementById('group-filter')?.value || '';
  const categoryVal = document.getElementById('category-filter')?.value || '';
  const prefectureVal = document.getElementById('prefecture-filter')?.value || '';
  const sortVal = document.getElementById('sort-filter')?.value || 'name_asc';
  const visibilityVal = document.getElementById('visibility-filter')?.value || 'visible';
  
  const showActive = document.getElementById('status-active-chk')?.checked;
  const showGraduated = document.getElementById('status-graduated-chk')?.checked;

  let filtered = allMembers.filter(m => {
    const g = m.groups ? allGroups.find(x => x.id === m.group_id) : null;

    const effectiveCategory = m.category || (g ? g.category : '');
    const effectivePrefecture = m.prefecture || (g ? g.prefecture : '');

    // 1. キーワード検索
    const nameStr = (m.name || '').toLowerCase();
    const rubyStr = (m.ruby || '').toLowerCase();
    const groupStr = (m.groups?.name || '').toLowerCase();
    const matchKey = nameStr.includes(keyword) || rubyStr.includes(keyword) || groupStr.includes(keyword);

    // 2. グループ・区分・拠点・ステータス判定
    const matchGroup = !groupVal || String(m.group_id) === groupVal;
    const matchCategory = !categoryVal || effectiveCategory === categoryVal;
    const matchPrefecture = !prefectureVal || effectivePrefecture === prefectureVal;

    const status = m.status || 'active';
    let matchStatus = false;
    if (status === 'active' && showActive) matchStatus = true;
    if (status === 'graduated' && showGraduated) matchStatus = true;

    // 💡 3. 表示設定（is_hidden）フィルタ判定
    // デフォルト（選択なし、または visible）のときは「表示(is_hidden === false)」のみ抽出
    // "hidden" のときは「非表示(is_hidden === true)」のみ抽出
    // "all" 等を追加する場合は全件ヒット
    const isHidden = m.is_hidden ?? false;
    let matchVisibility = true;
    
    if (visibilityVal === 'visible') {
      matchVisibility = !isHidden; // 表示対象のみ
    } else if (visibilityVal === 'hidden') {
      matchVisibility = isHidden;  // 非表示のみ
    } else if (visibilityVal === '') {
      // 💡 未選択時のデフォルト挙動：基本は「表示対象のみ」を表示したい場合
      matchVisibility = !isHidden; 
    }

    return matchKey && matchGroup && matchCategory && matchPrefecture && matchStatus && matchVisibility;
  });

  // ソート処理
  filtered.sort((a, b) => {
    switch (sortVal) {
      case 'name_asc': {
        const rubyA = a.ruby || a.name || '';
        const rubyB = b.ruby || b.name || '';
        return rubyA.localeCompare(rubyB, 'ja');
      }
      case 'group_asc': {
        const groupA = a.groups?.name || 'ZZZ';
        const groupB = b.groups?.name || 'ZZZ';
        const groupCompare = groupA.localeCompare(groupB, 'ja');
        if (groupCompare !== 0) return groupCompare;
        const rubyA = a.ruby || a.name || '';
        const rubyB = b.ruby || b.name || '';
        return rubyA.localeCompare(rubyB, 'ja');
      }
      case 'created_desc':
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      case 'created_asc':
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      default:
        return 0;
    }
  });

  renderMembers(filtered);
};

// ページ最上部（またはタブ上部）へスムーズスクロール
function scrollToGroupTop() {
  const tabContent = document.getElementById('tab-content-groups');
  if (tabContent) {
    const offsetPosition = tabContent.getBoundingClientRect().top + window.pageYOffset - 80;
    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
  }
}

// 特定のグループセクションへスムーズスクロール（固定ヘッダーの高さを考慮）
function jumpToGroupSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) {
    const headerOffset = 150; // 固定ヘッダー分のオフセット
    const elementPosition = el.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
}

// レンダリング処理（あいうえお順 ＆ 拠点別 ＆ 区分別 対応版）
function renderGroups() {
  const container = document.getElementById('groups-list');
  const jumpBar = document.getElementById('group-index-jump-bar');
  const sortModeSelect = document.getElementById('group-sort-mode');
  
  if (!container || !jumpBar) return;

  if (allGroups.length === 0) {
    container.innerHTML = '<div class="text-center py-10 text-xs text-slate-500">グループが登録されていません</div>';
    jumpBar.innerHTML = `
      <button onclick="scrollToGroupTop()" class="px-3 py-1 bg-slate-800 hover:bg-purple-600 text-slate-200 hover:text-white rounded-lg font-bold transition flex-shrink-0 border border-slate-700">
        TOP
      </button>
    `;
    return;
  }

  const sortMode = sortModeSelect ? sortModeSelect.value : 'kana';

  // ジャンプバーを初期化（TOPボタンを常駐）
  jumpBar.innerHTML = `
    <button onclick="scrollToGroupTop()" class="px-3 py-1 bg-slate-800 hover:bg-purple-600 text-slate-200 hover:text-white rounded-lg font-bold transition flex-shrink-0 border border-slate-700">
      TOP
    </button>
  `;

  // 1. あいうえお順モードの場合
  if (sortMode === 'kana') {
    const sortedGroups = [...allGroups].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        ${sortedGroups.map(g => createGroupCardHtml(g)).join('')}
      </div>
    `;
    return;
  }

  // 2. 拠点（都道府県）別モードの場合
  if (sortMode === 'prefecture') {
    const groupsByPref = {};
    allGroups.forEach(g => {
      const pref = g.prefecture || '拠点未設定';
      if (!groupsByPref[pref]) groupsByPref[pref] = [];
      groupsByPref[pref].push(g);
    });

    container.innerHTML = '';
    Object.keys(groupsByPref).forEach(pref => {
      const groupList = groupsByPref[pref];
      const sectionId = `group-pref-${pref}`;

      const jumpBtn = document.createElement('button');
      jumpBtn.className = "px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg transition flex-shrink-0 border border-slate-800 text-xs";
      jumpBtn.textContent = `${pref} (${groupList.length})`;
      jumpBtn.onclick = () => jumpToGroupSection(sectionId);
      jumpBar.appendChild(jumpBtn);

      const sectionDiv = document.createElement('div');
      sectionDiv.id = sectionId;
      sectionDiv.className = "space-y-3";
      sectionDiv.innerHTML = `
        <div class="flex items-center gap-3 border-b border-slate-800 pb-2">
          <h3 class="text-sm font-extrabold text-purple-400">${pref}</h3>
          <span class="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">${groupList.length}件</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          ${groupList.map(g => createGroupCardHtml(g)).join('')}
        </div>
      `;
      container.appendChild(sectionDiv);
    });
    return;
  }

  // 3. 区分別モードの場合
  if (sortMode === 'category') {
    const groupsByCategory = {};
    allGroups.forEach(g => {
      // グループに category プロパティがある前提（なければ 'other'）
      const catKey = g.category || 'other';
      if (!groupsByCategory[catKey]) groupsByCategory[catKey] = [];
      groupsByCategory[catKey].push(g);
    });

    container.innerHTML = '';
    Object.keys(groupsByCategory).forEach(catKey => {
      const groupList = groupsByCategory[catKey];
      // common.js の CATEGORY_NAME_MAP を利用して日本語ラベルに変換
      const catLabel = (typeof CATEGORY_NAME_MAP !== 'undefined' && CATEGORY_NAME_MAP[catKey]) ? CATEGORY_NAME_MAP[catKey] : (catKey || '未分類');
      const sectionId = `group-cat-${catKey}`;

      const jumpBtn = document.createElement('button');
      jumpBtn.className = "px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg transition flex-shrink-0 border border-slate-800 text-xs";
      jumpBtn.textContent = `${catLabel} (${groupList.length})`;
      jumpBtn.onclick = () => jumpToGroupSection(sectionId);
      jumpBar.appendChild(jumpBtn);

      const sectionDiv = document.createElement('div');
      sectionDiv.id = sectionId;
      sectionDiv.className = "space-y-3";
      sectionDiv.innerHTML = `
        <div class="flex items-center gap-3 border-b border-slate-800 pb-2">
          <h3 class="text-sm font-extrabold text-purple-400">${catLabel}</h3>
          <span class="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">${groupList.length}件</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          ${groupList.map(g => createGroupCardHtml(g)).join('')}
        </div>
      `;
      container.appendChild(sectionDiv);
    });
  }
}

// グループカードのHTML生成を共通化するためのヘルパー関数
function createGroupCardHtml(g) {
  const imgUrl = g.image_url || 'https://via.placeholder.com/300x150?text=Group+Image';
  const memberCount = allMembers.filter(m => m.group_id === g.id).length;
  const locText = [g.prefecture, g.area_note].filter(Boolean).join(' ') || '拠点未設定';

  return `
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg hover:border-purple-500/50 transition">
      <div class="h-28 bg-slate-950 relative">
        <img src="${imgUrl}" class="w-full h-full object-cover">
        <button onclick="openGroupModal(${g.id})" class="absolute top-2 right-2 bg-slate-950/80 hover:bg-purple-600 text-white text-[10px] px-2 py-1 rounded-lg border border-slate-700 backdrop-blur-sm transition">
          ✏️ 編集
        </button>
      </div>
      <div class="p-3 flex justify-between items-center">
        <div>
          <div class="font-extrabold text-sm text-slate-100">${g.name}</div>
          <div class="text-[10px] text-slate-400">${locText}</div>
        </div>
        <span class="text-xs bg-purple-950/60 text-purple-300 border border-purple-800/50 px-2 py-0.5 rounded-full font-bold">
          ${memberCount}名
        </span>
      </div>
    </div>
  `;
}

// ページ最上部へスムーズスクロール
function scrollToActiveTop() {
  const tabContent = document.getElementById('tab-content-active');
  if (tabContent) {
    const offsetPosition = tabContent.getBoundingClientRect().top + window.pageYOffset - 20;
    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
  }
}

// 特定のグループセクションへスムーズスクロール（固定ヘッダーの高さを考慮）
function jumpToActiveSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) {
    const headerOffset = 210; // 固定ヘッダー分のオフセット
    const elementPosition = el.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
}

// ユーザー表示設定のレンダリング処理（グループ化・ジャンプ対応版）
function renderActiveManagement() {
  const container = document.getElementById('active-management-list');
  const jumpBar = document.getElementById('active-index-jump-bar');
  const sortModeSelect = document.getElementById('active-sort-mode');
  
  if (!container || !jumpBar) return;

  if (!allGroups || allGroups.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-xs text-slate-500">グループを登録すると表示設定が可能になります</div>';
    jumpBar.innerHTML = `
      <button onclick="scrollToActiveTop()" class="px-3 py-1 bg-slate-800 hover:bg-pink-600 text-slate-200 hover:text-white rounded-lg font-bold transition flex-shrink-0 border border-slate-700">
        TOP
      </button>
    `;
    return;
  }

  const sortMode = sortModeSelect ? sortModeSelect.value : 'kana';

  // ジャンプバーを初期化（TOPボタンを常駐）
  jumpBar.innerHTML = `
    <button onclick="scrollToActiveTop()" class="px-3 py-1 bg-slate-800 hover:bg-pink-600 text-slate-200 hover:text-white rounded-lg font-bold transition flex-shrink-0 border border-slate-700">
      TOP
    </button>
  `;

  // 1つのグループカードのHTMLを生成するヘルパー関数
  const buildGroupCardHtml = (g) => {
    const groupMembers = allMembers.filter(m => String(m.group_id) === String(g.id));
    const isGroupAllVisible = groupMembers.length > 0 && groupMembers.every(m => !m.is_hidden);

    const membersHtml = groupMembers.map(m => {
      const isVisible = !m.is_hidden;
      return `
        <label class="flex items-center space-x-2 p-2 bg-slate-950/60 rounded-xl border border-slate-800/60 cursor-pointer hover:border-slate-700 transition">
          <input type="checkbox" ${isVisible ? 'checked' : ''} onchange="toggleUserMemberVisibility('${m.id}', !this.checked)" class="accent-pink-500 rounded">
          <span class="text-xs font-bold text-slate-200 truncate">${m.name}</span>
        </label>
      `;
    }).join('');

    return `
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div class="flex justify-between items-center border-b border-slate-800 pb-2">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" ${isGroupAllVisible ? 'checked' : ''} onchange="toggleUserGroupVisibility('${g.id}', !this.checked)" class="accent-purple-500 rounded">
            <span class="font-black text-sm text-purple-400">${g.name}</span>
          </label>
          <span class="text-[10px] text-slate-500">${groupMembers.length}名</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          ${membersHtml || '<div class="col-span-full text-[10px] text-slate-600">メンバー未登録</div>'}
        </div>
      </div>
    `;
  };

  // 1. あいうえお順モードの場合
  if (sortMode === 'kana') {
    const sortedGroups = [...allGroups].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
    container.innerHTML = `
      <div class="space-y-4">
        ${sortedGroups.map(g => buildGroupCardHtml(g)).join('')}
      </div>
    `;
    return;
  }

  // 2. 拠点別モードの場合
  if (sortMode === 'prefecture') {
    const groupsByPref = {};
    allGroups.forEach(g => {
      const pref = g.prefecture || '拠点未設定';
      if (!groupsByPref[pref]) groupsByPref[pref] = [];
      groupsByPref[pref].push(g);
    });

    container.innerHTML = '';
    Object.keys(groupsByPref).forEach(pref => {
      const groupList = groupsByPref[pref];
      const sectionId = `active-pref-${pref}`;

      const jumpBtn = document.createElement('button');
      jumpBtn.className = "px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg transition flex-shrink-0 border border-slate-800 text-xs";
      jumpBtn.textContent = `${pref} (${groupList.length})`;
      jumpBtn.onclick = () => jumpToActiveSection(sectionId);
      jumpBar.appendChild(jumpBtn);

      const sectionDiv = document.createElement('div');
      sectionDiv.id = sectionId;
      sectionDiv.className = "space-y-3";
      sectionDiv.innerHTML = `
        <div class="flex items-center gap-3 border-b border-slate-800 pb-2">
          <h3 class="text-sm font-extrabold text-pink-400">${pref}</h3>
          <span class="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">${groupList.length}グループ</span>
        </div>
        <div class="space-y-4">
          ${groupList.map(g => buildGroupCardHtml(g)).join('')}
        </div>
      `;
      container.appendChild(sectionDiv);
    });
    return;
  }

  // 3. 区分別モードの場合
  if (sortMode === 'category') {
    const groupsByCategory = {};
    allGroups.forEach(g => {
      const catKey = g.category || 'other';
      if (!groupsByCategory[catKey]) groupsByCategory[catKey] = [];
      groupsByCategory[catKey].push(g);
    });

    container.innerHTML = '';
    Object.keys(groupsByCategory).forEach(catKey => {
      const groupList = groupsByCategory[catKey];
      const catLabel = (typeof CATEGORY_NAME_MAP !== 'undefined' && CATEGORY_NAME_MAP[catKey]) ? CATEGORY_NAME_MAP[catKey] : (catKey || '未分類');
      const sectionId = `active-cat-${catKey}`;

      const jumpBtn = document.createElement('button');
      jumpBtn.className = "px-3 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg transition flex-shrink-0 border border-slate-800 text-xs";
      jumpBtn.textContent = `${catLabel} (${groupList.length})`;
      jumpBtn.onclick = () => jumpToActiveSection(sectionId);
      jumpBar.appendChild(jumpBtn);

      const sectionDiv = document.createElement('div');
      sectionDiv.id = sectionId;
      sectionDiv.className = "space-y-3";
      sectionDiv.innerHTML = `
        <div class="flex items-center gap-3 border-b border-slate-800 pb-2">
          <h3 class="text-sm font-extrabold text-pink-400">${catLabel}</h3>
          <span class="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">${groupList.length}グループ</span>
        </div>
        <div class="space-y-4">
          ${groupList.map(g => buildGroupCardHtml(g)).join('')}
        </div>
      `;
      container.appendChild(sectionDiv);
    });
  }
}

/**
 * 💡 単一メンバーのオンメモリ切り替え（DB保存は保存ボタン押下時）
 */
function toggleUserMemberVisibility(memberId, newIsHidden) {
  const member = allMembers.find(m => String(m.id) === String(memberId));
  if (member) {
    member.is_hidden = newIsHidden;
  }
  
  // TAB 1 等のフィルタ一覧をリアルタイム同期
  if (typeof filterMembers === 'function') filterMembers();
}

/**
 * 💡 グループ一括のオンメモリ切り替え（DB保存は保存ボタン押下時）
 */
function toggleUserGroupVisibility(groupId, newIsHidden) {
  const groupMembers = allMembers.filter(m => String(m.group_id) === String(groupId));
  groupMembers.forEach(m => {
    m.is_hidden = newIsHidden;
  });

  // UI（メンバー個別のチェックボックス表示）を再描画して一致させる
  renderActiveManagement();
  
  // TAB 1 等のフィルタ一覧をリアルタイム同期
  if (typeof filterMembers === 'function') filterMembers();
}

/**
 * 💡 保存ボタン押下時：全メンバーの表示設定を Supabase へ一括保存
 */
async function saveUserMemberSettings() {
  const user = (await supabase.auth.getUser())?.data?.user;
  if (!user) {
    if (typeof showToast === 'function') {
      showToast('ログインが必要です', 'error');
    }
    return;
  }

  // 保存対象データの準備
  const upsertData = allMembers.map(m => ({
    user_id: user.id,
    member_id: m.id,
    is_hidden: m.is_hidden ?? false
  }));

  if (upsertData.length === 0) {
    if (typeof showToast === 'function') {
      showToast('保存対象のメンバーがいません', 'warning');
    }
    return;
  }

  // 💡 汎用確認ダイアログの表示
  const isConfirmed = await window.showConfirmModal({
    title: '表示設定の保存',
    message: '現在のプレイ用表示設定（ON/OFF）を保存しますか？',
    confirmText: '保存する',
    cancelText: 'キャンセル',
    type: 'info',
    showCancel: true
  });

  // キャンセルされた場合は処理を中断
  if (!isConfirmed) return;

  // Supabase へ 1リクエストでまとめて一括 upsert
  const { error } = await supabase
    .from('user_member_settings')
    .upsert(upsertData, {
      onConflict: 'user_id,member_id'
    });

  if (error) {
    console.error('表示設定の保存に失敗:', error);
    if (typeof showToast === 'function') {
      showToast('表示設定の保存に失敗しました', 'error');
    }
  } else {
    if (typeof showToast === 'function') {
      showToast('表示設定を保存しました！', 'success');
    }
  }
}

async function toggleGroupActive(groupId, isActive) {
  await supabase.from('groups').update({ is_active: isActive }).eq('id', groupId);
  const g = allGroups.find(x => x.id === groupId);
  if (g) g.is_active = isActive;
}

async function toggleMemberActive(memberId, isActive) {
  await supabase.from('members').update({ is_active: isActive }).eq('id', memberId);
  const m = allMembers.find(x => x.id === memberId);
  if (m) m.is_active = isActive;
}

// 5. 画像プレビュー＆ペースト処理（メンバー / グループ両対応）
function handleMemberFileSelect(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  addFilesToMemberModal(files);
  // 同じファイルを続けて選択できるようにinputをリセット
  e.target.value = '';
}

function handleGroupFileSelect(e) {
  const file = e.target.files[0];
  if (file) setPreviewFile(file, 'group');
}

function setPreviewFile(file, target) {
  const reader = new FileReader();
  reader.onload = (e) => {
    if (target === 'member') {
      memberSelectedFile = file;
      const preview = document.getElementById('image-preview');
      preview.src = e.target.result;
      preview.classList.remove('hidden');
      document.getElementById('upload-placeholder').classList.add('hidden');
    } else {
      groupSelectedFile = file;
      const preview = document.getElementById('group-image-preview');
      preview.src = e.target.result;
      preview.classList.remove('hidden');
      document.getElementById('group-upload-placeholder').classList.add('hidden');
    }
  };
  reader.readAsDataURL(file);
}

// 2. 共通のファイル追加＆上限チェック処理
function addFilesToMemberModal(files) {
  // 現在の枚数 ＋ 追加しようとする枚数が 10枚を超えるかチェック
  if (currentModalImages.length + files.length > MAX_IMAGES) {
    showToast(`画像は最大 ${MAX_IMAGES} 枚までしか登録できません（現在: ${currentModalImages.length}枚）`, 'error');
    return;
  }

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      // 新規追加したファイルは、保存時に区別できるように 'temp_' の仮IDを付与
      const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      
      currentModalImages.push({
        id: tempId,
        image_url: e.target.result,
        is_temp: true, // 新規追加の目印
        file: file     // 後で圧縮・アップロードするために実ファイルを保持
      });

      // 新しく追加された画像へ自動でインデックスを移動してバナーを更新
      currentImageIndex = currentModalImages.length - 1;
      updateMemberImageBanner();
    };
    reader.readAsDataURL(file);
  });
}

async function pasteFromClipboard(target = null) {
  // target未指定の場合は、開いているモーダルを自動特定
  if (!target) {
    if (!document.getElementById('group-modal').classList.contains('hidden')) {
      target = 'group';
    } else {
      target = 'member';
    }
  }

  // グループ側（従来通りの単一画像）の場合
  if (target === 'group') {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find(t => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          setPreviewFile(new File([blob], "pasted_image.png", { type }), 'group');
          return;
        }
      }
      showToast('クリップボードに画像が見つかりませんでした', 'warning');
    } catch (err) {
      showToast('クリップボードの読み取り権限を許可してください', 'warning');
    }
    return;
  }

  // メンバー側（マルチ画像対応のペースト）
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find(t => t.startsWith('image/'));
      if (type) {
        const blob = await item.getType(type);
        const file = new File([blob], "pasted_image.png", { type });
        addFilesToMemberModal([file]);
        return;
      }
    }
    showToast('クリップボードに画像が見つかりませんでした', 'warning');
  } catch (err) {
    showToast('クリップボードの読み取り権限を許可してください', 'warning');
  }
}

function setupPasteHandler() {
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          const target = !document.getElementById('group-modal').classList.contains('hidden') ? 'group' : 'member';
          setPreviewFile(blob, target);
        }
      }
    }
  });
}

// 6. モーダル制御
window.openGroupModal = function(groupId = null) {
  groupSelectedFile = null;
  
  // フォームを一度リセット
  const form = document.getElementById('group-form');
  if (form) form.reset();

  document.getElementById('group-id').value = groupId || '';
  const preview = document.getElementById('group-image-preview');
  if (preview) {
    preview.classList.add('hidden');
    preview.src = '';
  }
  const placeholder = document.getElementById('group-upload-placeholder');
  if (placeholder) placeholder.classList.remove('hidden');

  if (groupId) {
    const g = allGroups.find(x => x.id === groupId);
    if (g) {
      document.getElementById('group-name').value = g.name || '';
      document.getElementById('group-category').value = g.category || 'idol';
      // 拠点都道府県とエリア補足を確実にセット
      document.getElementById('group-prefecture').value = g.prefecture || '東京都';
      document.getElementById('group-area-note').value = g.area_note || '';

      if (g.image_url && preview) {
        preview.src = g.image_url;
        preview.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');
      }
    }
    document.getElementById('group-modal-title').innerText = 'グループ編集';
  } else {
    document.getElementById('group-modal-title').innerText = 'グループ / 店舗を追加';
  }

  const modal = document.getElementById('group-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
};

window.closeGroupModal = function() {
  const modal = document.getElementById('group-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
};

// モーダル制御（メンバー）

window.openMemberModal = function(memberId = null) {
  memberSelectedFile = null;
  currentModalImages = [];
  currentImageIndex = 0;
  currentFavoriteImageId = null;

  const form = document.getElementById('member-form');
  if (form) form.reset();

  document.getElementById('member-id').value = memberId || '';

  // プレビュー・バナー要素の初期化
  const bannerContainer = document.getElementById('member-image-banner-container');
  const bannerImg = document.getElementById('banner-preview-img');
  const placeholder = document.getElementById('upload-placeholder');

  if (bannerContainer) bannerContainer.classList.add('hidden');
  if (bannerImg) bannerImg.src = '';
  if (placeholder) placeholder.classList.remove('hidden');

  if (memberId) {
    const m = allMembers.find(x => x.id === memberId);
    if (m) {
      document.getElementById('member-name').value = m.name || '';
      document.getElementById('member-ruby').value = m.ruby || '';
      document.getElementById('member-group').value = m.group_id || '';
      document.getElementById('member-category').value = m.category || '';
      document.getElementById('member-prefecture').value = m.prefecture || '';
      document.getElementById('member-tags').value = (m.tags || []).join(', ');

      const radios = document.getElementsByName('member-status');
      radios.forEach(r => r.checked = (r.value === (m.status || 'active')));

      // 1. メンバーが持つ画像一覧を取得（ID・URLが揃った配列）
      currentModalImages = m.member_images ? JSON.parse(JSON.stringify(m.member_images)) : [];

      // 2. お気に入り画像IDの決定
      const userSetting = m.user_member_settings;
      currentFavoriteImageId = userSetting?.favorite_image_id || currentModalImages.find(i => i.is_default)?.id || currentModalImages[0]?.id || null;

      // 🌟 3. お気に入り画像のインデックス（順番）を初期表示に設定
      if (currentFavoriteImageId && currentModalImages.length > 0) {
        const favIndex = currentModalImages.findIndex(img => String(img.id) === String(currentFavoriteImageId));
        if (favIndex !== -1) {
          currentImageIndex = favIndex;
        }
      }

      // バナーUIを更新・表示
      if (typeof updateMemberImageBanner === 'function') {
        updateMemberImageBanner();
      }
    }
    document.getElementById('modal-title').innerText = 'メンバー編集';
  } else {
    document.getElementById('modal-title').innerText = 'メンバーを追加';
  }

  const modal = document.getElementById('member-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
};

window.closeMemberModal = function() {
  const modal = document.getElementById('member-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

// バナーの表示内容（画像・ドット・❤の状態）を更新する関数
function updateMemberImageBanner() {
  const bannerContainer = document.getElementById('member-image-banner-container');
  const bannerImg = document.getElementById('banner-preview-img');
  const placeholder = document.getElementById('upload-placeholder');
  const counterText = document.getElementById('image-counter-text');
  const dotsContainer = document.getElementById('image-dots-container');
  const favoriteBtn = document.getElementById('set-favorite-btn');

  if (!currentModalImages || currentModalImages.length === 0) {
    if (bannerContainer) bannerContainer.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    return;
  }

  if (bannerContainer) bannerContainer.classList.remove('hidden');
  if (placeholder) placeholder.classList.add('hidden');

  // インデックスの安全化
  if (currentImageIndex >= currentModalImages.length) {
    currentImageIndex = currentModalImages.length - 1;
  }
  if (currentImageIndex < 0) currentImageIndex = 0;

  const currentImgObj = currentModalImages[currentImageIndex];
  if (bannerImg) bannerImg.src = currentImgObj.image_url;

  // カウンター更新
  if (counterText) {
    counterText.innerText = `${currentImageIndex + 1} / ${currentModalImages.length} 枚`;
  }

  // ドットインジケーター生成
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    currentModalImages.forEach((img, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `w-2 h-2 rounded-full transition ${idx === currentImageIndex ? 'bg-pink-500 scale-125' : 'bg-slate-700 hover:bg-slate-500'}`;
      dot.onclick = () => {
        currentImageIndex = idx;
        updateMemberImageBanner();
      };
      dotsContainer.appendChild(dot);
    });
  }

  // ❤ お気に入りボタンの見た目切り替え（currentFavoriteImageId と一致しているか）
  if (favoriteBtn) {
    const isFav = currentImgObj.id === currentFavoriteImageId;
    favoriteBtn.innerHTML = isFav ? '❤️' : '🤍';
    favoriteBtn.title = isFav ? 'お気に入り設定中' : 'この画像をお気に入りに設定';
    favoriteBtn.className = `absolute top-2 right-2 p-1.5 rounded-full text-sm transition shadow ${isFav ? 'bg-pink-600 text-white' : 'bg-slate-900/80 hover:bg-slate-900 text-slate-400'}`;
  }
}

// 前の画像へ
window.prevMemberImage = function() {
  if (currentModalImages.length <= 1) return;
  currentImageIndex = (currentImageIndex - 1 + currentModalImages.length) % currentModalImages.length;
  updateMemberImageBanner();
};

// 次の画像へ
window.nextMemberImage = function() {
  if (currentModalImages.length <= 1) return;
  currentImageIndex = (currentImageIndex + 1) % currentModalImages.length;
  updateMemberImageBanner();
};

// 現在表示している画像を「お気に入り（メイン）」に指定
window.toggleCurrentAsFavorite = function() {
  const currentImgObj = currentModalImages[currentImageIndex];
  if (!currentImgObj) return;
  currentFavoriteImageId = currentImgObj.id;
  updateMemberImageBanner();
  showToast('お気に入り画像を切り替えました', 'success');
};

// 現在表示している画像を削除対象にする（モーダル内のみ。保存時に反映）
// 4. 画像の削除（★ 0番目（最初）の画像は削除できないようにガード）
window.removeCurrentMemberImage = async function() {
  if (currentImageIndex === 0) {
    showToast('最初に登録されたメイン画像（0番目）は削除できません', 'error');
    return;
  }
  if (currentModalImages.length <= 1) {
    showToast('最後の1枚は削除できません', 'error');
    return;
  }

  // 🌟 confirm を showConfirmModal + await に置き換え
  const ok = await showConfirmModal({
    title: '画像の削除',
    message: 'この画像を削除しますか？\n（「保存する」を押すと完全に反映されます）',
    confirmText: '削除する',
    cancelText: 'キャンセル',
    type: 'danger',
    showCancel: true
  });

  if (!ok) return;

  const removed = currentModalImages.splice(currentImageIndex, 1)[0];
  
  // もしお気に入りだったものが消えたら、0番目を新しいお気に入りに設定
  if (removed.id === currentFavoriteImageId) {
    currentFavoriteImageId = currentModalImages[0].id;
  }
  if (currentImageIndex >= currentModalImages.length) {
    currentImageIndex = currentModalImages.length - 1;
  }
  updateMemberImageBanner();
};


// 7. 保存処理（Supabase）
// 7. 保存処理（Supabase）- windowに登録して確実に呼び出せるようにする
window.saveMember = async function(e) {
  if (e) e.preventDefault();

  const saveBtn = document.querySelector('#member-modal button[onclick*="saveMember"]') || document.querySelector('#member-modal button[type="submit"]');
  const originalText = saveBtn ? saveBtn.innerText : '保存する';

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = '保存中...';
    saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }

  // フォームからの基本情報の取得
  const id = document.getElementById('member-id').value;
  const name = document.getElementById('member-name').value;
  const ruby = document.getElementById('member-ruby').value;
  const group_id = document.getElementById('member-group').value || null;
  const category = document.getElementById('member-category').value || null;
  const prefecture = document.getElementById('member-prefecture').value || null;
  const rawTags = document.getElementById('member-tags').value;
  const tags = rawTags ? rawTags.split(',').map(t => t.trim()).filter(t => t) : [];

  let status = 'active';
  const radios = document.getElementsByName('member-status');
  radios.forEach(r => { if (r.checked) status = r.value; });

  const payload = { name, ruby, group_id, category, prefecture, status, tags };

  try {
    let memberData;
    // 1. メンバー基本情報の保存（新規 or 更新）
    if (id) {
      const { data, error } = await supabase.from('members').update(payload).eq('id', id).select().single();
      if (error) throw error;
      memberData = data;
    } else {
      const { data, error } = await supabase.from('members').insert([payload]).select().single();
      if (error) throw error;
      memberData = data;
    }

    if (memberData) {
      // 2. マルチ画像（member_images）の同期処理
      // データベース上に既存の画像一覧を取得
      const { data: existingDbImages, error: fetchErr } = await supabase
        .from('member_images')
        .select('*')
        .eq('member_id', memberData.id);

      if (fetchErr) throw fetchErr;

      const existingDbIds = existingDbImages.map(img => img.id);
      const currentModalIds = currentModalImages
        .filter(img => !img.is_temp)
        .map(img => img.id);

      // (A) モーダル上で削除された画像をデータベース側でも削除
      const idsToDelete = existingDbIds.filter(dbId => !currentModalIds.includes(dbId));
      if (idsToDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('member_images')
          .delete()
          .in('id', idsToDelete);
        if (delErr) throw delErr;
      }

      // (B) 新規追加されたファイル（is_temp: true）を圧縮・ストレージアップロード・DBインサート
      let resolvedFavoriteId = currentFavoriteImageId;

      for (let i = 0; i < currentModalImages.length; i++) {
        const img = currentModalImages[i];

        if (img.is_temp && img.file) {
          // 圧縮処理（最大800px、画質80%）
          const compressedFile = await compressImageFile(img.file, 800, 800, 0.8);
          const filePath = `members/${memberData.id}_${Date.now()}_${i}`;
          
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('member-images')
            .upload(filePath, compressedFile);
          
          if (uploadErr) throw uploadErr;

          const { data: urlData } = supabase.storage
            .from('member-images')
            .getPublicUrl(filePath);

          // member_images テーブルへ保存
          const { data: newImgData, error: imgInsErr } = await supabase
            .from('member_images')
            .insert([{
              member_id: memberData.id,
              image_url: urlData.publicUrl
            }])
            .select()
            .single();

          if (imgInsErr) throw imgInsErr;

          // もし今回追加した一時画像がお気に入りに指定されていたら、正式なDBのIDに差し替え
          if (img.id === currentFavoriteImageId) {
            resolvedFavoriteId = newImgData.id;
          }
        }
      }

      // (C) お気に入り画像IDのフォールバック解決（未指定・または消えた場合）
      if (!resolvedFavoriteId) {
        const { data: finalImgs } = await supabase
          .from('member_images')
          .select('id')
          .eq('member_id', memberData.id)
          .order('id', { ascending: true })
          .limit(1);
        
        if (finalImgs && finalImgs.length > 0) {
          resolvedFavoriteId = finalImgs[0].id;
        }
      }

      // 3. ユーザーごとの設定（user_member_settings）にお気に入り画像IDを保存・更新
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const settingPayload = {
          user_id: user.id,
          member_id: memberData.id,
          favorite_image_id: resolvedFavoriteId || null
        };

        const { error: settingError } = await supabase
          .from('user_member_settings')
          .upsert(settingPayload, {
            onConflict: 'user_id,member_id'
          });

        if (settingError) {
          console.error('Settings Upsert Error:', settingError);
        }
      }
    }

    closeMemberModal();
    if (typeof loadAllData === 'function') {
      await loadAllData();
    }
    showToast('保存しました', 'success');

  } catch (err) {
    console.error('メンバー保存エラー:', err);
    showToast('保存に失敗しました: ' + (err.message || 'エラーが発生しました'), 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = originalText;
      saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
};

// 7. グループ保存処理（ボタンローディング状態の追加）
window.saveGroup = async function(e) {
  if (e) e.preventDefault();

  // 保存ボタン要素の取得とローディング状態化
  const saveBtn = e?.target?.querySelector('button[type="submit"]') || document.querySelector('#group-form button[onclick*="saveGroup"]');
  const originalBtnText = saveBtn ? saveBtn.innerText : '登録・保存';

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = '保存中...';
    saveBtn.classList.add('opacity-50', 'cursor-not-allowed');
  }

  const id = document.getElementById('group-id').value;
  const name = document.getElementById('group-name').value;
  const category = document.getElementById('group-category').value;
  const prefecture = document.getElementById('group-prefecture').value;
  const area_note = document.getElementById('group-area-note').value;

  let imageUrl = null;
  try {
    if (groupSelectedFile) {
      const filePath = `groups/${Date.now()}_${groupSelectedFile.name}`;
      const { data: uploadData } = await supabase.storage.from('member-images').upload(filePath, groupSelectedFile);
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('member-images').getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }
    }

    const updateObj = { 
      name, 
      category, 
      prefecture, 
      area_note 
    };
    if (imageUrl) updateObj.image_url = imageUrl;

    if (id) {
      const { error } = await supabase.from('groups').update(updateObj).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('groups').insert([updateObj]);
      if (error) throw error;
    }

    closeGroupModal();
    await loadAllData();
  } catch (err) {
    console.error('グループ保存エラー:', err);
    showToast('保存に失敗しました: ' + (err.message || 'エラーが発生しました'), 'error');
  } finally {
    // 処理終了後にボタン状態を復元
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = originalBtnText;
      saveBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
};

function switchTab(tab) {
  ['members', 'groups', 'active'].forEach(t => {
    document.getElementById(`tab-content-${t}`).classList.add('hidden');
    const btn = document.getElementById(`tab-btn-${t}`);
    btn.className = "pb-3 px-4 border-b-2 border-transparent text-slate-400 hover:text-slate-200 transition";
  });

  document.getElementById(`tab-content-${tab}`).classList.remove('hidden');
  const activeBtn = document.getElementById(`tab-btn-${tab}`);
  activeBtn.className = "pb-3 px-4 border-b-2 border-pink-500 text-pink-400 transition font-bold";
}

/**
 * 絞り込み詳細パネルの開閉トグル
 */
function toggleFilterPanel() {
  const panel = document.getElementById('filter-details-panel');
  const icon = document.getElementById('filter-arrow-icon');
  
  if (!panel || !icon) return;

  const isHidden = panel.classList.contains('hidden');

  if (isHidden) {
    panel.classList.remove('hidden');
    icon.style.transform = 'rotate(0deg)';
  } else {
    panel.classList.add('hidden');
    icon.style.transform = 'rotate(-90deg)';
  }
}


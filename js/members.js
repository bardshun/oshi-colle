let allMembers = [];
let allGroups = [];
let memberSelectedFile = null;
let groupSelectedFile = null;
let currentCardSize = 'lg'; // 初期サイズ: 大

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

  // 1. 全メンバー情報（マスター）を取得
  const { data, error } = await supabase
    .from('members')
    .select(`*, groups(*), member_images(image_url, is_default)`)
    .order('name');

  if (error) {
    console.error('メンバー一覧の取得に失敗:', error);
    allMembers = [];
    return;
  }

  const rawMembers = data || [];

  // 2. ログインユーザー個人の表示設定を取得（ログイン時のみ）
  let settingsMap = new Map();
  if (user) {
    const { data: userSettings, error: sError } = await supabase
      .from('user_member_settings')
      .select('member_id, is_hidden')
      .eq('user_id', user.id);

    if (!sError && userSettings) {
      // member_id をキーにして Map 化
      settingsMap = new Map(userSettings.map(s => [String(s.member_id), s.is_hidden]));
    }
  }

  // 3. マスターデータに is_hidden（ユーザー設定）を結合
  allMembers = rawMembers.map(m => ({
    ...m,
    // 保存データがあればその is_hidden を適用、無ければ false（表示）
    is_hidden: settingsMap.has(String(m.id)) ? settingsMap.get(String(m.id)) : false
  }));

  // 💡 4. 描画処理の初期実行（もし初期化フローで個別に呼んでいない場合はここで同期）
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
    const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
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

// 3. グループ描画
function renderGroups() {
  const container = document.getElementById('groups-list');
  if (allGroups.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-10 text-xs text-slate-500">グループが登録されていません</div>';
    return;
  }

  container.innerHTML = allGroups.map(g => {
    const imgUrl = g.image_url || 'https://via.placeholder.com/300x150?text=Group+Image';
    const memberCount = allMembers.filter(m => m.group_id === g.id).length;
    
    // 都道府県とエリア補足を綺麗に結合して表示
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
  }).join('');
}

// 4. 表示/非表示（アクティブ選択）一覧描画
function renderActiveManagement() {
  const container = document.getElementById('active-management-list');
  if (!container) return;

  if (!allGroups || allGroups.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-xs text-slate-500">グループを登録すると表示設定が可能になります</div>';
    return;
  }

  container.innerHTML = allGroups.map(g => {
    // 該当グループのメンバー一覧
    const groupMembers = allMembers.filter(m => String(m.group_id) === String(g.id));
    
    // グループ内のメンバー全員が表示状態（is_hidden が false または未定義）ならグループチェックON
    const isGroupAllVisible = groupMembers.length > 0 && groupMembers.every(m => !m.is_hidden);

    const membersHtml = groupMembers.map(m => {
      const isVisible = !m.is_hidden; // is_hidden が false のとき「表示(ON)」
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
  }).join('');
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
  const file = e.target.files[0];
  if (file) setPreviewFile(file, 'member');
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

async function pasteFromClipboard(target = null) {
  // target未指定の場合は、開いているモーダルを自動特定
  if (!target) {
    if (!document.getElementById('group-modal').classList.contains('hidden')) {
      target = 'group';
    } else {
      target = 'member';
    }
  }

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find(t => t.startsWith('image/'));
      if (type) {
        const blob = await item.getType(type);
        setPreviewFile(new File([blob], "pasted_image.png", { type }), target);
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
  const form = document.getElementById('member-form');
  if (form) form.reset();

  document.getElementById('member-id').value = memberId || '';
  
  const preview = document.getElementById('image-preview');
  if (preview) {
    preview.classList.add('hidden');
    preview.src = '';
  }
  const placeholder = document.getElementById('upload-placeholder');
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

      const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
      if (defaultImg && preview) {
        preview.src = defaultImg.image_url;
        preview.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');
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
    if (id) {
      const { data, error } = await supabase.from('members').update(payload).eq('id', id).select().single();
      if (error) throw error;
      memberData = data;
    } else {
      const { data, error } = await supabase.from('members').insert([payload]).select().single();
      if (error) throw error;
      memberData = data;
    }

    if (memberSelectedFile && memberData) {
      const filePath = `members/${memberData.id}_${Date.now()}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage.from('member-images').upload(filePath, memberSelectedFile);
      if (uploadErr) throw uploadErr;

      if (uploadData) {
        const { data: urlData } = supabase.storage.from('member-images').getPublicUrl(filePath);
        await supabase.from('member_images').insert([{ member_id: memberData.id, image_url: urlData.publicUrl, is_default: true }]);
      }
    }

    closeMemberModal();
    await loadAllData();
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


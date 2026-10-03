let allMembers = [];
let allGroups = [];
let memberSelectedFile = null;
let groupSelectedFile = null;
let currentCardSize = 'lg'; // 初期サイズ: 大

document.addEventListener('DOMContentLoaded', async () => {
  setupPasteHandler();
  await loadAllData();
});

async function loadAllData() {
  await Promise.all([loadGroups(), loadMembers()]);
  renderMembers();
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
  const { data } = await supabase
    .from('members')
    .select(`*, groups(*), member_images(image_url, is_default)`)
    .order('name');
  allMembers = data || [];
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
    const groupName = m.groups ? m.groups.name : '未所属';

    // --- パターン1: 小（画像なし・シンプル表示） ---
    if (currentCardSize === 'sm') {
      return `
        <div onclick="openMemberModal(${m.id})" class="bg-slate-900/90 border border-slate-800 hover:border-pink-500/60 p-2 rounded-xl transition cursor-pointer relative ${isGrad ? 'opacity-50' : ''}">
          <div class="text-[9px] text-pink-400 font-bold truncate">${groupName}</div>
          <div class="font-bold text-xs text-slate-100 truncate">${m.name}</div>
          ${isGrad ? '<span class="text-[8px] text-gray-500 block">卒業</span>' : ''}
        </div>
      `;
    }

    // --- パターン2: 中（スマホ3列コンパクト表示） ---
    if (currentCardSize === 'md') {
      return `
        <div class="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-md hover:border-pink-500/50 transition relative ${isGrad ? 'opacity-60' : ''}">
          <div class="aspect-square bg-slate-950 relative overflow-hidden">
            <img src="${imgUrl}" class="w-full h-full object-cover">
            <button onclick="openMemberModal(${m.id})" class="absolute top-1 right-1 bg-slate-950/80 hover:bg-pink-600 text-white text-[9px] px-1.5 py-0.5 rounded border border-slate-700 backdrop-blur-sm transition">
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
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg group hover:border-pink-500/50 transition relative ${isGrad ? 'opacity-60' : ''}">
        <div class="aspect-square bg-slate-950 relative overflow-hidden">
          <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
          <button onclick="openMemberModal(${m.id})" class="absolute top-2 right-2 bg-slate-950/80 hover:bg-pink-600 text-white text-[10px] px-2 py-1 rounded-lg border border-slate-700 backdrop-blur-sm transition">
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
  const keyword = document.getElementById('search-input')?.value.toLowerCase() || '';
  const groupVal = document.getElementById('group-filter')?.value || '';
  const categoryVal = document.getElementById('category-filter')?.value || '';
  const prefectureVal = document.getElementById('prefecture-filter')?.value || '';
  
  const showActive = document.getElementById('status-active-chk')?.checked;
  const showGraduated = document.getElementById('status-graduated-chk')?.checked;

  const filtered = allMembers.filter(m => {
    const g = m.groups ? allGroups.find(x => x.id === m.group_id) : null;

    // 💡 優先判定ロジック: 個人の設定があれば最優先、無ければグループの設定を参照
    const effectiveCategory = m.category || (g ? g.category : '');
    const effectivePrefecture = m.prefecture || (g ? g.prefecture : '');

    // 1. キーワード検索
    const matchKey = m.name.toLowerCase().includes(keyword) || 
                     (m.ruby && m.ruby.toLowerCase().includes(keyword)) || 
                     (m.groups && m.groups.name.toLowerCase().includes(keyword));

    // 2. グループ指定
    const matchGroup = !groupVal || String(m.group_id) === groupVal;

    // 3. 区分指定（実効値で判定）
    const matchCategory = !categoryVal || effectiveCategory === categoryVal;

    // 4. 拠点指定（実効値で判定）
    const matchPrefecture = !prefectureVal || effectivePrefecture === prefectureVal;

    // 5. ステータス判定
    const status = m.status || 'active';
    let matchStatus = false;
    if (status === 'active' && showActive) matchStatus = true;
    if (status === 'graduated' && showGraduated) matchStatus = true;

    return matchKey && matchGroup && matchCategory && matchPrefecture && matchStatus;
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
  if (allGroups.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-xs text-slate-500">グループを登録すると表示設定が可能になります</div>';
    return;
  }

  container.innerHTML = allGroups.map(g => {
    const groupMembers = allMembers.filter(m => m.group_id === g.id);
    const membersHtml = groupMembers.map(m => `
      <label class="flex items-center space-x-2 p-2 bg-slate-950/60 rounded-xl border border-slate-800/60 cursor-pointer hover:border-slate-700 transition">
        <input type="checkbox" ${m.is_active !== false ? 'checked' : ''} onchange="toggleMemberActive(${m.id}, this.checked)" class="accent-pink-500 rounded">
        <span class="text-xs font-bold text-slate-200 truncate">${m.name}</span>
      </label>
    `).join('');

    return `
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div class="flex justify-between items-center border-b border-slate-800 pb-2">
          <label class="flex items-center space-x-2 cursor-pointer">
            <input type="checkbox" ${g.is_active !== false ? 'checked' : ''} onchange="toggleGroupActive(${g.id}, this.checked)" class="accent-purple-500 rounded">
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
    alert('クリップボードに画像が見つかりませんでした');
  } catch (err) {
    alert('クリップボードの読み取り権限を許可してください');
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
    alert('保存に失敗しました: ' + (err.message || 'エラーが発生しました'));
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
    alert('保存に失敗しました: ' + (err.message || 'エラーが発生しました'));
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
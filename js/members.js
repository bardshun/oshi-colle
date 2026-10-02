let allMembers = [];
let allGroups = [];
let memberSelectedFile = null;
let groupSelectedFile = null;

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
    .select(`*, groups(name), member_images(image_url, is_default)`)
    .order('name');
  allMembers = data || [];
}

// 2. メンバー描画 & フィルター
function renderMembers(filteredList = null) {
  const container = document.getElementById('members-list');
  const list = filteredList || allMembers;

  if (list.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-10 text-xs text-slate-500">メンバーが見つかりません</div>';
    return;
  }

  container.innerHTML = list.map(m => {
    const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
    const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/150?text=No+Img';
    const isGrad = m.status === 'graduated';

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
          <div class="text-[10px] text-pink-400 font-bold truncate">${m.groups ? m.groups.name : '未所属'}</div>
          <div class="font-extrabold text-sm text-slate-100 truncate">${m.name}</div>
          ${m.ruby ? `<div class="text-[9px] text-slate-400 truncate">${m.ruby}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function filterMembers() {
  const keyword = document.getElementById('search-input')?.value.toLowerCase() || '';
  const groupVal = document.getElementById('group-filter')?.value || '';

  const filtered = allMembers.filter(m => {
    const matchKey = m.name.toLowerCase().includes(keyword) || (m.ruby && m.ruby.toLowerCase().includes(keyword)) || (m.groups && m.groups.name.toLowerCase().includes(keyword));
    const matchGroup = !groupVal || String(m.group_id) === groupVal;
    return matchKey && matchGroup;
  });

  renderMembers(filtered);
}

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
            <div class="text-[10px] text-slate-400">${g.location || '拠点未設定'}</div>
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
function openMemberModal(memberId = null) {
  memberSelectedFile = null;
  document.getElementById('member-id').value = memberId || '';
  const preview = document.getElementById('image-preview');
  preview.classList.add('hidden');
  preview.src = '';
  document.getElementById('upload-placeholder').classList.remove('hidden');

  if (memberId) {
    const m = allMembers.find(x => x.id === memberId);
    document.getElementById('member-name').value = m.name || '';
    document.getElementById('member-ruby').value = m.ruby || '';
    document.getElementById('member-group').value = m.group_id || '';
    document.getElementById('member-tags').value = (m.tags || []).join(', ');
    
    const radios = document.getElementsByName('member-status');
    radios.forEach(r => r.checked = (r.value === (m.status || 'active')));

    const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
    if (defaultImg) {
      preview.src = defaultImg.image_url;
      preview.classList.remove('hidden');
      document.getElementById('upload-placeholder').classList.add('hidden');
    }

    document.getElementById('modal-title').innerText = 'メンバー編集';
  } else {
    document.getElementById('member-form').reset();
    document.getElementById('modal-title').innerText = 'メンバーを追加';
  }
  document.getElementById('member-modal').classList.remove('hidden');
}

function closeMemberModal() {
  document.getElementById('member-modal').classList.add('hidden');
}

// windowオブジェクトに明示的に登録
window.openGroupModal = function(groupId = null) {
  groupSelectedFile = null;
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
      const locParts = (g.location || '').split(' ');
      document.getElementById('group-prefecture').value = locParts[0] || '東京都';
      document.getElementById('group-area-note').value = locParts.slice(1).join(' ') || '';

      if (g.image_url && preview) {
        preview.src = g.image_url;
        preview.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');
      }
    }
    document.getElementById('group-modal-title').innerText = 'グループ編集';
  } else {
    document.getElementById('group-form').reset();
    document.getElementById('group-modal-title').innerText = 'グループ / 店舗を追加';
  }

  // モーダルを表示
  const modal = document.getElementById('group-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex'); // 中央寄せを確実に適用
};

window.closeGroupModal = function() {
  const modal = document.getElementById('group-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
};

// 7. 保存処理（Supabase）
async function saveMember(e) {
  e.preventDefault();
  const id = document.getElementById('member-id').value;
  const name = document.getElementById('member-name').value;
  const ruby = document.getElementById('member-ruby').value;
  const group_id = document.getElementById('member-group').value || null;
  const rawTags = document.getElementById('member-tags').value;
  const tags = rawTags ? rawTags.split(',').map(t => t.trim()).filter(t => t) : [];

  let status = 'active';
  const radios = document.getElementsByName('member-status');
  radios.forEach(r => { if (r.checked) status = r.value; });

  let memberData;
  const payload = { name, ruby, group_id, status, tags };

  if (id) {
    const { data } = await supabase.from('members').update(payload).eq('id', id).select().single();
    memberData = data;
  } else {
    const { data } = await supabase.from('members').insert([payload]).select().single();
    memberData = data;
  }

  if (memberSelectedFile && memberData) {
    const filePath = `members/${memberData.id}_${Date.now()}`;
    const { data: uploadData } = await supabase.storage.from('member-images').upload(filePath, memberSelectedFile);

    if (uploadData) {
      const { data: urlData } = supabase.storage.from('member-images').getPublicUrl(filePath);
      await supabase.from('member_images').insert([{ member_id: memberData.id, image_url: urlData.publicUrl, is_default: true }]);
    }
  }

  closeMemberModal();
  await loadAllData();
}

async function saveGroup(e) {
  e.preventDefault();
  const id = document.getElementById('group-id').value;
  const name = document.getElementById('group-name').value;
  const pref = document.getElementById('group-prefecture').value;
  const areaNote = document.getElementById('group-area-note').value;
  const location = areaNote ? `${pref} ${areaNote}` : pref;

  let imageUrl = null;
  if (groupSelectedFile) {
    const filePath = `groups/${Date.now()}_${groupSelectedFile.name}`;
    const { data: uploadData } = await supabase.storage.from('member-images').upload(filePath, groupSelectedFile);
    if (uploadData) {
      const { data: urlData } = supabase.storage.from('member-images').getPublicUrl(filePath);
      imageUrl = urlData.publicUrl;
    }
  }

  if (id) {
    const updateObj = { name, location };
    if (imageUrl) updateObj.image_url = imageUrl;
    await supabase.from('groups').update(updateObj).eq('id', id);
  } else {
    await supabase.from('groups').insert([{ name, location, image_url: imageUrl }]);
  }

  closeGroupModal();
  await loadAllData();
}

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
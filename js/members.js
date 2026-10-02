let allMembers = [];
let allGroups = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadAllData();
});

async function loadAllData() {
  await Promise.all([loadGroups(), loadMembers()]);
  renderMembers();
  renderGroups();
  renderActiveManagement();
}

// 1. Supabaseデータ取得
async function loadGroups() {
  const { data } = await supabase.from('groups').select('*').order('name');
  allGroups = data || [];
  
  // モーダルのセレクトボックス更新
  const select = document.getElementById('member-group');
  if (select) {
    select.innerHTML = allGroups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  }
}

async function loadMembers() {
  const { data } = await supabase
    .from('members')
    .select(`*, groups(name), member_images(image_url, is_default)`)
    .order('name');
  allMembers = data || [];
}

// 2. メンバー描画＆編集
function renderMembers() {
  const container = document.getElementById('members-list');
  if (allMembers.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-8 text-xs text-slate-500">メンバーが登録されていません</div>';
    return;
  }

  container.innerHTML = allMembers.map(m => {
    const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
    const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/150?text=No+Img';
    return `
      <div class="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg group hover:border-pink-500/50 transition">
        <div class="aspect-square bg-slate-950 relative overflow-hidden">
          <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
          <button onclick="openMemberModal(${m.id})" class="absolute top-2 right-2 bg-slate-950/80 hover:bg-pink-600 text-white text-[10px] px-2 py-1 rounded-lg border border-slate-700 backdrop-blur-sm transition">
            ✏️ 編集
          </button>
        </div>
        <div class="p-3">
          <div class="text-[10px] text-pink-400 font-bold truncate">${m.groups ? m.groups.name : '未所属'}</div>
          <div class="font-extrabold text-sm text-slate-100 truncate">${m.name}</div>
        </div>
      </div>
    `;
  }).join('');
}

// 3. グループ描画＆編集
function renderGroups() {
  const container = document.getElementById('groups-list');
  if (allGroups.length === 0) {
    container.innerHTML = '<div class="col-span-full text-center py-8 text-xs text-slate-500">グループが登録されていません</div>';
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

// 5. ON/OFFトグル関数
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

// 6. タブ切り替え
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

// 7. モーダル＆保存処理（メンバー / グループ）
function openMemberModal(memberId = null) {
  document.getElementById('member-id').value = memberId || '';
  if (memberId) {
    const m = allMembers.find(x => x.id === memberId);
    document.getElementById('member-name').value = m.name;
    document.getElementById('member-group').value = m.group_id;
    document.getElementById('member-modal-title').innerText = 'メンバー編集';
  } else {
    document.getElementById('member-form').reset();
    document.getElementById('member-modal-title').innerText = 'メンバー登録';
  }
  document.getElementById('member-modal').classList.remove('hidden');
}

function closeMemberModal() {
  document.getElementById('member-modal').classList.add('hidden');
}

function openGroupModal(groupId = null) {
  document.getElementById('group-id').value = groupId || '';
  if (groupId) {
    const g = allGroups.find(x => x.id === groupId);
    document.getElementById('group-name').value = g.name;
    document.getElementById('group-location').value = g.location || '';
    document.getElementById('group-modal-title').innerText = 'グループ編集';
  } else {
    document.getElementById('group-form').reset();
    document.getElementById('group-modal-title').innerText = 'グループ登録';
  }
  document.getElementById('group-modal').classList.remove('hidden');
}

closeGroupModal = () => document.getElementById('group-modal').classList.add('hidden');

// 保存処理（Supabase）
async function saveMember(e) {
  e.preventDefault();
  const id = document.getElementById('member-id').value;
  const name = document.getElementById('member-name').value;
  const group_id = document.getElementById('member-group').value;
  const fileInput = document.getElementById('member-image-file');

  let memberData;
  if (id) {
    const { data } = await supabase.from('members').update({ name, group_id }).eq('id', id).select().single();
    memberData = data;
  } else {
    const { data } = await supabase.from('members').insert([{ name, group_id }]).select().single();
    memberData = data;
  }

  // 画像のアップロード
  if (fileInput.files.length > 0 && memberData) {
    const file = fileInput.files[0];
    const filePath = `members/${memberData.id}_${Date.now()}`;
    const { data: uploadData } = await supabase.storage.from('member-images').upload(filePath, file);

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
  const location = document.getElementById('group-location').value;
  const fileInput = document.getElementById('group-image-file');

  let imageUrl = null;
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const filePath = `groups/${Date.now()}_${file.name}`;
    const { data: uploadData } = await supabase.storage.from('member-images').upload(filePath, file);
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

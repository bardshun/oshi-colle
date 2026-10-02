let currentMembers = [];
let currentGroups = [];
let selectedImageFile = null;

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', () => {
  loadGroups();
  loadMembers();
  setupPasteEvent();
});

// 1. グループ一覧読み込み
async function loadGroups() {
  const { data, error } = await supabase.from('groups').select('*').order('name');
  if (error) {
    console.error('グループ取得失敗:', error);
    return;
  }
  currentGroups = data || [];

  // ドロップダウン＆フィルターの更新
  const memberGroupSelect = document.getElementById('member-group');
  const groupFilterSelect = document.getElementById('group-filter');

  memberGroupSelect.innerHTML = '<option value="">未所属・フリー</option>';
  groupFilterSelect.innerHTML = '<option value="">🏢 すべてのグループ/店舗</option>';

  currentGroups.forEach(g => {
    const prefText = g.prefecture ? ` (${g.prefecture})` : '';
    memberGroupSelect.innerHTML += `<option value="${g.id}">${g.name}${prefText}</option>`;
    groupFilterSelect.innerHTML += `<option value="${g.id}">${g.name}${prefText}</option>`;
  });
}

// 2. メンバー一覧読み込み
async function loadMembers() {
  const memberGrid = document.getElementById('member-grid');
  memberGrid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500">読み込み中...</div>';

  // メンバー情報 ＋ グループ情報 ＋ メイン画像を結合取得
  const { data, error } = await supabase
    .from('members')
    .select(`
      *,
      groups ( name, prefecture ),
      member_images ( id, image_url, is_default )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('メンバー取得失敗:', error);
    memberGrid.innerHTML = '<div class="col-span-full text-center py-10 text-red-400">データの読み込みに失敗しました</div>';
    return;
  }

  currentMembers = data || [];
  renderMembers(currentMembers);
}

// 3. メンバーカードの描画
function renderMembers(members) {
  const memberGrid = document.getElementById('member-grid');
  if (members.length === 0) {
    memberGrid.innerHTML = '<div class="col-span-full text-center py-10 text-gray-500">メンバーが登録されていません</div>';
    return;
  }

  memberGrid.innerHTML = members.map(m => {
    // 表示画像（デフォルト指定画像、無ければ最初の画像、無ければプレースホルダー）
    const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
    const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/200x200?text=No+Image';

    const groupName = m.groups ? m.groups.name : '未所属';
    const statusBadge = m.status === 'graduated' ? '<span class="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">卒業</span>' : '';
    const tagsHtml = (m.tags || []).map(t => `<span class="bg-gray-700 text-pink-300 text-[10px] px-1.5 py-0.5 rounded">#${t}</span>`).join(' ');

    return `
      <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col hover:border-gray-500 transition">
        <div class="aspect-square bg-gray-900 relative overflow-hidden">
          <img src="${imgUrl}" alt="${m.name}" class="w-full h-full object-cover">
          ${statusBadge ? `<div class="absolute top-2 left-2">${statusBadge}</div>` : ''}
        </div>
        <div class="p-3 flex-1 flex flex-col justify-between space-y-2">
          <div>
            <div class="text-xs text-pink-400 font-bold truncate">${groupName}</div>
            <div class="font-bold text-sm text-white truncate">${m.name}</div>
            <div class="flex flex-wrap gap-1 mt-1">${tagsHtml}</div>
          </div>
          <button onclick="openEditMemberModal(${m.id})" class="w-full text-xs bg-gray-700 hover:bg-gray-600 py-1 rounded text-gray-300 transition">
            編集
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 4. リアルタイム絞り込みフィルター
function filterMembers() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const groupVal = document.getElementById('group-filter').value;
  const statusVal = document.getElementById('status-filter').value;

  const filtered = currentMembers.filter(m => {
    const matchName = m.name.toLowerCase().includes(search) || (m.ruby && m.ruby.toLowerCase().includes(search));
    const matchGroup = !groupVal || String(m.group_id) === groupVal;
    const matchStatus = !statusVal || m.status === statusVal;
    return matchName && matchGroup && matchStatus;
  });

  renderMembers(filtered);
}

// 5. 画像選択・ペースト処理
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) setPreviewImage(file);
}

function setPreviewImage(file) {
  selectedImageFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const imgEl = document.getElementById('image-preview');
    imgEl.src = e.target.result;
    imgEl.classList.remove('hidden');
    document.getElementById('upload-placeholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

// クリップボードからの貼り付け（長押し/Ctrl+Vイベント）
function setupPasteEvent() {
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        setPreviewImage(file);
        break;
      }
    }
  });
}

// クリップボード読み込みボタン（ワンタップ用）
async function pasteFromClipboard() {
  try {
    const clipboardItems = await navigator.clipboard.read();
    for (const item of clipboardItems) {
      const imageType = item.types.find(type => type.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const file = new File([blob], 'pasted_image.png', { type: imageType });
        setPreviewImage(file);
        alert('クリップボードから画像を読み込みました！');
        return;
      }
    }
    alert('クリップボードに画像が見つかりませんでした。');
  } catch (err) {
    alert('クリップボードの読み取り権限がないか、長押しペーストをご利用ください。');
  }
}

// 6. メンバー保存処理（Supabase DB + Storage）
async function saveMember(e) {
  e.preventDefault();
  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.innerText = '保存中...';

  const memberId = document.getElementById('member-id').value;
  const name = document.getElementById('member-name').value;
  const ruby = document.getElementById('member-ruby').value;
  const groupId = document.getElementById('member-group').value || null;
  const status = document.querySelector('input[name="member-status"]:checked').value;
  const tagsText = document.getElementById('member-tags').value;
  const tags = tagsText ? tagsText.split(',').map(t => t.trim()).filter(Boolean) : [];

  try {
    let savedMemberId = memberId;

    if (memberId) {
      // 更新
      await supabase.from('members').update({ name, ruby, group_id: groupId, status, tags }).eq('id', memberId);
    } else {
      // 新規追加
      const { data, error } = await supabase.from('members').insert([{ name, ruby, group_id: groupId, status, tags }]).select();
      if (error) throw error;
      savedMemberId = data[0].id;
    }

    // 画像のアップロード処理（画像が選択されている場合）
    if (selectedImageFile && savedMemberId) {
      const fileExt = selectedImageFile.name.split('.').pop() || 'png';
      const fileName = `${savedMemberId}_${Date.now()}.${fileExt}`;

      // Storageへアップロード
      const { error: uploadError } = await supabase.storage
        .from('member-images')
        .upload(fileName, selectedImageFile);

      if (uploadError) throw uploadError;

      // 公開URLの取得
      const { data: urlData } = supabase.storage.from('member-images').getPublicUrl(fileName);

      // member_images テーブルへ保存
      await supabase.from('member_images').insert([{
        member_id: savedMemberId,
        image_url: urlData.publicUrl,
        is_default: true
      }]);
    }

    closeMemberModal();
    loadMembers();
  } catch (err) {
    console.error('保存エラー:', err);
    alert('保存に失敗しました: ' + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = '保存する';
  }
}

// 7. グループ新規保存処理
async function saveGroup(e) {
  e.preventDefault();
  const name = document.getElementById('group-name').value;
  const category = document.getElementById('group-category').value;
  const prefecture = document.getElementById('group-prefecture').value;
  const areaNote = document.getElementById('group-area-note').value;

  const { data, error } = await supabase.from('groups').insert([{ name, category, prefecture, area_note: areaNote }]).select();
  if (error) {
    alert('グループ追加失敗: ' + error.message);
    return;
  }

  closeGroupModal();
  await loadGroups();
  if (data && data[0]) {
    document.getElementById('member-group').value = data[0].id; // 追加したグループを自動選択
  }
}

// モーダル開閉系関数
function openMemberModal() {
  document.getElementById('member-form').reset();
  document.getElementById('member-id').value = '';
  document.getElementById('modal-title').innerText = 'メンバーを追加';
  document.getElementById('image-preview').classList.add('hidden');
  document.getElementById('upload-placeholder').classList.remove('hidden');
  selectedImageFile = null;
  document.getElementById('member-modal').classList.remove('hidden');
}

function closeMemberModal() {
  document.getElementById('member-modal').classList.add('hidden');
}

function openGroupModal() {
  document.getElementById('group-form').reset();
  document.getElementById('group-modal').classList.remove('hidden');
}

function closeGroupModal() {
  document.getElementById('group-modal').classList.add('hidden');
}

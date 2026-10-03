let membersList = [];
let currentIndex = 0;
let userNames = { A: '', B: '', C: '' };
let currentLikes = { A: false, B: false, C: false };
let matchResults = []; // [{ member: {}, likes: {A:bool, B:bool, C:bool} }]

document.addEventListener('DOMContentLoaded', async () => {
  await initFilterOptions();
});

/**
 * 💡 拠点（prefecture）と区分（category）のチェックボックスリストを動的生成
 */
async function initFilterOptions() {
  const prefContainer = document.getElementById('filter-prefecture-list');
  const catContainer = document.getElementById('filter-category-list');
  if (!prefContainer || !catContainer) return;

  const { data: groups } = await supabase.from('groups').select('prefecture, category');
  if (!groups) return;

  const prefectures = [...new Set(groups.map(g => g.prefecture).filter(Boolean))].sort();
  const categories = [...new Set(groups.map(g => g.category).filter(Boolean))].sort();

  // 拠点チェックボックス
  prefContainer.innerHTML = prefectures.map(pref => `
    <label class="flex items-center space-x-2 cursor-pointer hover:text-white">
      <input type="checkbox" value="${pref}" class="pref-checkbox form-checkbox h-3.5 w-3.5 text-pink-600 rounded bg-gray-800 border-gray-600 focus:ring-0" checked>
      <span class="truncate">${pref}</span>
    </label>
  `).join('') || '<span class="text-gray-500 text-[10px]">データなし</span>';

  // 💡 区分チェックボックス（valueはidolのまま、表示名だけ「アイドル」に変換）
  catContainer.innerHTML = categories.map(cat => `
    <label class="flex items-center space-x-2 cursor-pointer hover:text-white">
      <input type="checkbox" value="${cat}" class="cat-checkbox form-checkbox h-3.5 w-3.5 text-pink-600 rounded bg-gray-800 border-gray-600 focus:ring-0" checked>
      <span class="truncate">${getCategoryLabel(cat)}</span>
    </label>
  `).join('') || '<span class="text-gray-500 text-[10px]">データなし</span>';
}

/**
 * すべて選択 / 解除の便利ボタン用ヘルパー
 */
function toggleAllCheckboxes(containerId, isChecked) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(cb => cb.checked = isChecked);
}

// 1. ゲーム初期化
async function startGame() {
  userNames.A = document.getElementById('user-a-name')?.value || 'Aさん';
  userNames.B = document.getElementById('user-b-name')?.value || 'Bさん';
  userNames.C = document.getElementById('user-c-name')?.value || 'Cさん';

  // 💡 チェックされている拠点と区分を取得
  const selectedPrefectures = Array.from(document.querySelectorAll('.pref-checkbox:checked')).map(cb => cb.value);
  const selectedCategories = Array.from(document.querySelectorAll('.cat-checkbox:checked')).map(cb => cb.value);

  if (selectedPrefectures.length === 0 || selectedCategories.length === 0) {
    alert('拠点と区分はそれぞれ最低1つ以上選択してください。');
    return;
  }

  // ボタンラベル更新
  document.getElementById('label-user-a').innerText = userNames.A;
  document.getElementById('label-user-b').innerText = userNames.B;
  document.getElementById('label-user-c').innerText = userNames.C;

  const user = (await supabase.auth.getUser())?.data?.user;

  // Supabaseからメンバーと設定を取得
  const [membersRes, settingsRes] = await Promise.all([
    supabase
      .from('members')
      .select(`*, groups(name, prefecture, category), member_images(image_url, is_default)`),
    user
      ? supabase.from('user_member_settings').select('member_id, is_hidden').eq('user_id', user.id)
      : Promise.resolve({ data: [] })
  ]);

  if (membersRes.error || !membersRes.data || membersRes.data.length === 0) {
    alert('メンバーデータが取得できませんでした。');
    return;
  }

  const settingsMap = new Map((settingsRes.data || []).map(s => [String(s.member_id), s.is_hidden]));

  // 💡 ① 非表示メンバー除外 ＆ ② チェックされた拠点・区分に含まれるか判定
  const filteredMembers = membersRes.data.filter(m => {
    const isHidden = settingsMap.get(String(m.id)) ?? false;
    if (isHidden) return false;

    const pref = m.groups?.prefecture;
    const cat = m.groups?.category;

    // 拠点・区分がチェックに含まれているかチェック
    const matchesPref = pref ? selectedPrefectures.includes(pref) : true;
    const matchesCat = cat ? selectedCategories.includes(cat) : true;

    return matchesPref && matchesCat;
  });

  if (filteredMembers.length === 0) {
    alert('選択された条件に一致する表示可能なメンバーがいません。選択を変更してください。');
    return;
  }

  // ランダムシャッフル
  membersList = filteredMembers.sort(() => Math.random() - 0.5);
  currentIndex = 0;
  matchResults = [];

  // 画面切り替え
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');

  showCurrentMember();
}

// 2. 現在のメンバー表示
function showCurrentMember() {
  if (currentIndex >= membersList.length) {
    showResults();
    return;
  }

  const m = membersList[currentIndex];
  const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
  const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/300?text=No+Image';

  document.getElementById('current-member-img').src = imgUrl;
  document.getElementById('current-group-name').innerText = m.groups ? m.groups.name : '未所属';
  document.getElementById('current-member-name').innerText = m.name;

  // タグ表示
  const tagsHtml = (m.tags || []).map(t => `<span class="bg-gray-700 text-pink-300 text-[10px] px-1.5 py-0.5 rounded">#${t}</span>`).join(' ');
  document.getElementById('current-member-tags').innerHTML = tagsHtml;

  // 進捗表示
  document.getElementById('progress-text').innerText = `${currentIndex + 1} / ${membersList.length} 名目`;

  // 「前の顔へ」ボタンの有効化/無効化切り替え
  const prevBtn = document.getElementById('btn-prev-member');
  if (prevBtn) {
    prevBtn.disabled = currentIndex === 0;
  }

  // 既に一度選択履歴がある場合はその選択状態を復元、なければリセット
  if (matchResults[currentIndex]) {
    currentLikes = { ...matchResults[currentIndex].likes };
  } else {
    currentLikes = { A: false, B: false, C: false };
  }

  updateButtonStyles();
}

// 3. 好きフラグのトグル
function toggleLike(user) {
  currentLikes[user] = !currentLikes[user];
  updateButtonStyles();
}

function updateButtonStyles() {
  ['A', 'B', 'C'].forEach(u => {
    const btn = document.getElementById(`btn-user-${u.toLowerCase()}`);
    if (!btn) return;

    const isLiked = currentLikes[u];
    
    if (isLiked) {
      btn.className = 'p-3 rounded-xl border-2 border-pink-400 bg-pink-600 text-white transition flex flex-col items-center justify-center space-y-1 shadow-md';
      btn.querySelector('span:first-child').innerText = '💖';
    } else {
      btn.className = "p-3 rounded-xl border-2 border-gray-700 bg-gray-900/80 hover:bg-gray-800 transition flex flex-col items-center justify-center space-y-1";
      btn.querySelector('span:first-child').innerText = '🤍';
    }
  });
}

// 4. 次のメンバーへ
function nextMember() {
  // 現在の選択結果を保存（上書き）
  matchResults[currentIndex] = {
    member: membersList[currentIndex],
    likes: { ...currentLikes }
  };

  // 全員一致の数をカウントしてバッジ更新
  const allMatchCount = matchResults.filter(r => r && r.likes.A && r.likes.B && r.likes.C).length;
  document.getElementById('match-count-badge').innerText = `共通点: ${allMatchCount}名`;

  currentIndex++;
  showCurrentMember();
}

// 💡 4-B. 前のメンバーへ戻る
function prevMember() {
  if (currentIndex <= 0) return;

  // 一時的に現在の状態も記録
  matchResults[currentIndex] = {
    member: membersList[currentIndex],
    likes: { ...currentLikes }
  };

  currentIndex--;
  showCurrentMember();
}

// 💡 4-C. 途中で切り上げて結果を見る
function finishGameEarly() {
  if (matchResults.length === 0 && !currentLikes.A && !currentLikes.B && !currentLikes.C) {
    if (!confirm('まだどのメンバーも選択されていませんが、結果画面に進みますか？')) {
      return;
    }
  }

  // 現在表示中のメンバーの選択状態も結果に保存
  if (currentIndex < membersList.length) {
    matchResults[currentIndex] = {
      member: membersList[currentIndex],
      likes: { ...currentLikes }
    };
  }

  showResults();
}

// 5. 結果画面のレンダリング
function showResults() {
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('result-screen').classList.remove('hidden');

  // 有効な結果データ（undefined を除外）
  const validResults = matchResults.filter(Boolean);

  // ① 3人全員一致
  const allMatches = validResults.filter(r => r.likes.A && r.likes.B && r.likes.C);
  
  // ② 2人一致
  const abMatches = validResults.filter(r => r.likes.A && r.likes.B && !r.likes.C);
  const bcMatches = validResults.filter(r => !r.likes.A && r.likes.B && r.likes.C);
  const acMatches = validResults.filter(r => r.likes.A && !r.likes.B && r.likes.C);

  // ③ 1人のみ選択（個人の好み）
  const aOnlyMatches = validResults.filter(r => r.likes.A && !r.likes.B && !r.likes.C);
  const bOnlyMatches = validResults.filter(r => !r.likes.A && r.likes.B && !r.likes.C);
  const cOnlyMatches = validResults.filter(r => !r.likes.A && !r.likes.B && r.likes.C);

  // ------------------------------------
  // A. リスト表示の描画
  // ------------------------------------
  const allMatchEl = document.getElementById('result-all-match');
  if (allMatches.length === 0) {
    allMatchEl.innerHTML = '<div class="col-span-full text-center py-4 text-xs text-gray-500">3人全員が一致したメンバーはありませんでした 😅</div>';
  } else {
    allMatchEl.innerHTML = allMatches.map(r => createResultCardHtml(r.member)).join('');
  }

  const twoMatchEl = document.getElementById('result-two-match');
  let twoHtml = '';
  if (abMatches.length) twoHtml += renderGroupSection(`${userNames.A} ＆ ${userNames.B}`, abMatches, 'border-pink-500/40');
  if (bcMatches.length) twoHtml += renderGroupSection(`${userNames.B} ＆ ${userNames.C}`, bcMatches, 'border-blue-500/40');
  if (acMatches.length) twoHtml += renderGroupSection(`${userNames.A} ＆ ${userNames.C}`, acMatches, 'border-purple-500/40');
  twoMatchEl.innerHTML = twoHtml || '<div class="text-center py-2 text-gray-500">2人の共通点もありませんでした</div>';

  const oneMatchEl = document.getElementById('result-one-match');
  let oneHtml = '';
  if (aOnlyMatches.length) oneHtml += renderGroupSection(`${userNames.A} のみの好み`, aOnlyMatches, 'border-pink-500/30');
  if (bOnlyMatches.length) oneHtml += renderGroupSection(`${userNames.B} のみの好み`, bOnlyMatches, 'border-blue-500/30');
  if (cOnlyMatches.length) oneHtml += renderGroupSection(`${userNames.C} のみの好み`, cOnlyMatches, 'border-emerald-500/30');
  oneMatchEl.innerHTML = oneHtml || '<div class="text-center py-2 text-gray-500">1人のみの選択結果もありませんでした</div>';

  // ------------------------------------
  // B. マップ表示の描画（三角形レイアウト）
  // ------------------------------------
  renderTriangleMap({
    aOnly: aOnlyMatches,
    bOnly: bOnlyMatches,
    cOnly: cOnlyMatches,
    ab: abMatches,
    bc: bcMatches,
    ac: acMatches,
    abc: allMatches
  });

  // デフォルトはリスト表示
  switchResultView('list');
}

// 💡 6. マップ表示用描画（三角形レイアウト）
function renderTriangleMap(groupedData) {
  // ユーザーラベル更新
  document.getElementById('map-vertex-a-label').innerText = userNames.A;
  document.getElementById('map-vertex-b-label').innerText = userNames.B;
  document.getElementById('map-vertex-c-label').innerText = userNames.C;

  document.getElementById('map-edge-ab-label').innerText = `${userNames.A} & ${userNames.B}`;
  document.getElementById('map-edge-ac-label').innerText = `${userNames.A} & ${userNames.C}`;
  document.getElementById('map-edge-bc-label').innerText = `${userNames.B} & ${userNames.C}`;

  // 各ノードへカードを挿入
  renderMapNode('map-node-a', groupedData.aOnly);
  renderMapNode('map-node-b', groupedData.bOnly);
  renderMapNode('map-node-c', groupedData.cOnly);

  renderMapNode('map-node-ab', groupedData.ab);
  renderMapNode('map-node-ac', groupedData.ac);
  renderMapNode('map-node-bc', groupedData.bc);

  renderMapNode('map-node-abc', groupedData.abc, true);
}

function renderMapNode(elementId, matchArray, isCrown = false) {
  const container = document.getElementById(elementId);
  if (!container) return;

  if (!matchArray || matchArray.length === 0) {
    container.innerHTML = '<span class="text-[9px] text-gray-600 self-center py-1">なし</span>';
    return;
  }

  container.innerHTML = matchArray.map(r => {
    const m = r.member;
    const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
    const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/100';

    return `
      <div class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden border ${isCrown ? 'border-yellow-400' : 'border-gray-700'} relative group shrink-0 bg-slate-950" title="${m.name}">
        <img src="${imgUrl}" class="w-full h-full object-cover">
        <div class="absolute inset-x-0 bottom-0 bg-black/75 text-[7px] text-white truncate text-center px-0.5">
          ${m.name}
        </div>
      </div>
    `;
  }).join('');
}

// 💡 7. 結果画面表示切り替えタブ (list / map)
function switchResultView(viewType) {
  const listEl = document.getElementById('view-list');
  const mapEl = document.getElementById('view-map');

  const tabList = document.getElementById('tab-view-list');
  const tabMap = document.getElementById('tab-view-map');

  if (viewType === 'list') {
    listEl?.classList.remove('hidden');
    mapEl?.classList.add('hidden');

    tabList?.classList.add('bg-pink-600', 'text-white');
    tabList?.classList.remove('text-gray-400');

    tabMap?.classList.remove('bg-pink-600', 'text-white');
    tabMap?.classList.add('text-gray-400');
  } else {
    listEl?.classList.add('hidden');
    mapEl?.classList.remove('hidden');

    tabMap?.classList.add('bg-pink-600', 'text-white');
    tabMap?.classList.remove('text-gray-400');

    tabList?.classList.remove('bg-pink-600', 'text-white');
    tabList?.classList.add('text-gray-400');
  }
}

// 結果カードHTML作成共通化
function createResultCardHtml(m) {
  const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
  const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/150';

  return `
    <div class="bg-gray-900 rounded-xl overflow-hidden border border-gray-700/80 p-1 text-center shadow">
      <img src="${imgUrl}" class="w-full aspect-square object-cover rounded-lg mb-1">
      <div class="font-bold text-[11px] truncate">${m.name}</div>
      <div class="text-[9px] text-pink-400 truncate">${m.groups ? m.groups.name : ''}</div>
    </div>
  `;
}

function renderGroupSection(title, list, borderColorClass = 'border-gray-700') {
  const cards = list.map(r => createResultCardHtml(r.member)).join('');
  return `
    <div class="bg-gray-900/60 p-3 rounded-xl border ${borderColorClass} space-y-2">
      <div class="font-bold text-pink-300 text-xs">${title}</div>
      <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">${cards}</div>
    </div>
  `;
}

// ゲームリセット
function resetGame() {
  document.getElementById('result-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('setup-screen').classList.remove('hidden');
}

/**
 * 高画質＆全カードが見切れない完璧な結果画像を生成・保存
 */
async function downloadResultImage() {
  const isMapActive = !document.getElementById('view-map').classList.contains('hidden');
  const targetEl = isMapActive 
    ? document.getElementById('map-capture-area') 
    : document.getElementById('view-list');

  if (!targetEl) return;

  try {
    if (typeof showToast === 'function') showToast('画像を生成中...', 'info');

    // 画面に映っている要素を直接キャプチャ（scale: 2 で解像度倍増）
    const canvas = await html2canvas(targetEl, {
      backgroundColor: '#020617', // slate-950
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false
    });

    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `推しコレ_好きな顔マッチ_${dateStr}.png`;
    link.href = image;
    link.click();

    if (typeof showToast === 'function') showToast('画像を保存しました！', 'success');
  } catch (err) {
    console.error('画像保存エラー:', err);
    alert('画像の保存に失敗しました。');
  }
}
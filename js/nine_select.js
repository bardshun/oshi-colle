let allMembers = [];
let memberScores = new Map(); // member_id -> point

// 予選用状態
let qualifyingPages = []; // 9名ずつの配列
let currentQualifyingPageIndex = 0;
let selectedQualifyingIds = new Set();

// 本選用状態
let mainPages = []; // 9名ずつの配列
let currentMainPageIndex = 0;
let selectedMainIds = new Set();

// 決戦用状態
let matchQueue = [];
let currentMatch = null;

// DOM読み込み完了時
document.addEventListener('DOMContentLoaded', async () => {
  await initFilterOptions();
});

/**
 * 拠点と区分のチェックボックス初期化
 */
async function initFilterOptions() {
  const prefContainer = document.getElementById('filter-prefecture-list');
  const catContainer = document.getElementById('filter-category-list');
  if (!prefContainer || !catContainer) return;

  const { data: groups } = await supabase.from('groups').select('prefecture, category');
  if (!groups) return;

  const prefectures = [...new Set(groups.map(g => g.prefecture).filter(Boolean))].sort();
  const categories = [...new Set(groups.map(g => g.category).filter(Boolean))].sort();

  prefContainer.innerHTML = prefectures.map(pref => `
    <label class="flex items-center space-x-2 cursor-pointer hover:text-white">
      <input type="checkbox" value="${pref}" class="pref-checkbox form-checkbox h-3.5 w-3.5 text-pink-600 rounded bg-slate-900 border-slate-700 focus:ring-0" checked>
      <span class="truncate">${pref}</span>
    </label>
  `).join('');

  catContainer.innerHTML = categories.map(cat => `
    <label class="flex items-center space-x-2 cursor-pointer hover:text-white">
      <input type="checkbox" value="${cat}" class="cat-checkbox form-checkbox h-3.5 w-3.5 text-pink-600 rounded bg-slate-900 border-slate-700 focus:ring-0" checked>
      <span class="truncate">${getCategoryLabel ? getCategoryLabel(cat) : cat}</span>
    </label>
  `).join('');
}

function toggleAllCheckboxes(containerId, isChecked) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = isChecked);
}

/**
 * データを指定サイズごとに分割するヘルパー関数
 */
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * ゲームスタート (データ読み込み＆予選初期化)
 */
async function startNineSelect() {
  const selectedPrefectures = Array.from(document.querySelectorAll('.pref-checkbox:checked')).map(cb => cb.value);
  const selectedCategories = Array.from(document.querySelectorAll('.cat-checkbox:checked')).map(cb => cb.value);

  if (selectedPrefectures.length === 0 || selectedCategories.length === 0) {
    alert('拠点と区分は1つ以上選択してください。');
    return;
  }

  const user = (await supabase.auth.getUser())?.data?.user;

  const [membersRes, settingsRes] = await Promise.all([
    supabase.from('members').select(`*, groups(name, prefecture, category), member_images(image_url, is_default)`),
    user ? supabase.from('user_member_settings').select('member_id, is_hidden').eq('user_id', user.id) : Promise.resolve({ data: [] })
  ]);

  if (membersRes.error || !membersRes.data) {
    alert('メンバーデータの取得に失敗しました。');
    return;
  }

  const settingsMap = new Map((settingsRes.data || []).map(s => [String(s.member_id), s.is_hidden]));

  // 非表示除外＆フィルタリング＆ランダムシャッフル
  allMembers = membersRes.data
    .filter(m => {
      if (settingsMap.get(String(m.id)) ?? false) return false;
      const pref = m.groups?.prefecture;
      const cat = m.groups?.category;
      return (!pref || selectedPrefectures.includes(pref)) && (!cat || selectedCategories.includes(cat));
    })
    .sort(() => Math.random() - 0.5);

  if (allMembers.length < 9) {
    alert('選択された条件に一致するメンバーが9名未満です。条件を広げてください。');
    return;
  }

  // スコア・状態の初期化
  memberScores.clear();
  allMembers.forEach(m => memberScores.set(String(m.id), 0));
  selectedQualifyingIds.clear();
  selectedMainIds.clear();

  // 9名ずつのページに分割
  qualifyingPages = chunkArray(allMembers, 9);
  currentQualifyingPageIndex = 0;

  // 画面切り替え
  document.getElementById('phase-setup').classList.add('hidden');
  document.getElementById('phase-qualifying').classList.remove('hidden');

  renderQualifyingPage();
}

/**
 * PHASE 1: 予選ページの描画
 */
function renderQualifyingPage() {
  const pageMembers = qualifyingPages[currentQualifyingPageIndex] || [];
  const totalPages = qualifyingPages.length;

  // ページ情報の更新
  document.getElementById('qualifying-count').innerText = selectedQualifyingIds.size;
  const pageIndicator = document.getElementById('qualifying-page-indicator');
  if (pageIndicator) {
    pageIndicator.innerText = `${currentQualifyingPageIndex + 1} / ${totalPages} ページ目`;
  }

  const grid = document.getElementById('qualifying-grid');
  grid.innerHTML = pageMembers.map(m => {
    const memberIdStr = String(m.id);
    const isSelected = selectedQualifyingIds.has(memberIdStr);
    const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
    const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/100';

    return `
      <div onclick="toggleQualifyingSelect('${memberIdStr}')" id="qual-card-${memberIdStr}" 
           class="relative cursor-pointer rounded-xl overflow-hidden border-2 bg-slate-900 group select-none transition ${isSelected ? 'border-pink-500 scale-[0.98]' : 'border-slate-800'}">
        <div class="aspect-square w-full relative">
          <img src="${imgUrl}" class="w-full h-full object-cover">
          <div id="qual-check-${memberIdStr}" class="absolute top-1.5 right-1.5 bg-pink-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold transition ${isSelected ? '' : 'opacity-0'}">✓</div>
        </div>
        <div class="p-1.5 text-center bg-slate-900">
          <div class="text-[10px] font-bold text-slate-200 truncate">${m.name}</div>
        </div>
      </div>
    `;
  }).join('');

  // ボタンの表示切替（次へ or 予選完了）
  const nextBtn = document.getElementById('qualifying-next-btn');
  if (nextBtn) {
    if (currentQualifyingPageIndex < totalPages - 1) {
      nextBtn.innerText = `次の9名へ (${currentQualifyingPageIndex + 1}/${totalPages})`;
    } else {
      nextBtn.innerText = `予選完了 → 本選へ (${selectedQualifyingIds.size}名選出)`;
    }
  }
}

function toggleQualifyingSelect(memberIdStr) {
  const card = document.getElementById(`qual-card-${memberIdStr}`);
  const check = document.getElementById(`qual-check-${memberIdStr}`);

  if (selectedQualifyingIds.has(memberIdStr)) {
    selectedQualifyingIds.delete(memberIdStr);
    card.classList.remove('border-pink-500', 'scale-[0.98]');
    card.classList.add('border-slate-800');
    check.classList.add('opacity-0');
  } else {
    selectedQualifyingIds.add(memberIdStr);
    card.classList.remove('border-slate-800');
    card.classList.add('border-pink-500', 'scale-[0.98]');
    check.classList.remove('opacity-0');
  }

  document.getElementById('qualifying-count').innerText = selectedQualifyingIds.size;
}

/**
 * 予選：次へ / 完了ボタン処理
 */
function handleQualifyingNext() {
  const totalPages = qualifyingPages.length;

  if (currentQualifyingPageIndex < totalPages - 1) {
    currentQualifyingPageIndex++;
    renderQualifyingPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // 最終ページの場合、完了処理へ
    finishQualifying();
  }
}

/**
 * 予選完了 → 本選へ
 */
function finishQualifying() {
  if (selectedQualifyingIds.size < 9) {
    alert('9選を決定するため、予選全体で少なくとも9名以上を選択してください！');
    return;
  }

  // 予選通過者に +1 pt
  selectedQualifyingIds.forEach(id => {
    memberScores.set(id, (memberScores.get(id) || 0) + 1);
  });

  // 予選通過メンバーを抽出して本選用ページ（9名ずつ）を作成
  const qualifyingMembers = allMembers.filter(m => selectedQualifyingIds.has(String(m.id)));
  mainPages = chunkArray(qualifyingMembers, 9);
  currentMainPageIndex = 0;

  document.getElementById('phase-qualifying').classList.add('hidden');
  document.getElementById('phase-main').classList.remove('hidden');

  renderMainPage();
}

/**
 * PHASE 2: 本選ページの描画
 */
function renderMainPage() {
  const pageMembers = mainPages[currentMainPageIndex] || [];
  const totalPages = mainPages.length;

  document.getElementById('main-count').innerText = selectedMainIds.size;
  const pageIndicator = document.getElementById('main-page-indicator');
  if (pageIndicator) {
    pageIndicator.innerText = `${currentMainPageIndex + 1} / ${totalPages} ページ目`;
  }

  const grid = document.getElementById('main-grid');
  grid.innerHTML = pageMembers.map(m => {
    const memberIdStr = String(m.id);
    const isSelected = selectedMainIds.has(memberIdStr);
    const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
    const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/100';

    return `
      <div onclick="toggleMainSelect('${memberIdStr}')" id="main-card-${memberIdStr}" 
           class="relative cursor-pointer rounded-xl overflow-hidden border-2 bg-slate-900 group select-none transition ${isSelected ? 'border-purple-500 scale-[0.98]' : 'border-slate-800'}">
        <div class="aspect-square w-full relative">
          <img src="${imgUrl}" class="w-full h-full object-cover">
          <div id="main-check-${memberIdStr}" class="absolute top-1.5 right-1.5 bg-purple-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold transition ${isSelected ? '' : 'opacity-0'}">✓</div>
        </div>
        <div class="p-1.5 text-center bg-slate-900">
          <div class="text-[10px] font-bold text-slate-200 truncate">${m.name}</div>
        </div>
      </div>
    `;
  }).join('');

  const nextBtn = document.getElementById('main-next-btn');
  if (nextBtn) {
    if (currentMainPageIndex < totalPages - 1) {
      nextBtn.innerText = `次の9名へ (${currentMainPageIndex + 1}/${totalPages})`;
    } else {
      nextBtn.innerText = `厳選完了 → 決戦へ (${selectedMainIds.size}名選出)`;
    }
  }
}

function toggleMainSelect(memberIdStr) {
  const card = document.getElementById(`main-card-${memberIdStr}`);
  const check = document.getElementById(`main-check-${memberIdStr}`);

  if (selectedMainIds.has(memberIdStr)) {
    selectedMainIds.delete(memberIdStr);
    card.classList.remove('border-purple-500', 'scale-[0.98]');
    card.classList.add('border-slate-800');
    check.classList.add('opacity-0');
  } else {
    selectedMainIds.add(memberIdStr);
    card.classList.remove('border-slate-800');
    card.classList.add('border-purple-500', 'scale-[0.98]');
    check.classList.remove('opacity-0');
  }

  document.getElementById('main-count').innerText = selectedMainIds.size;
}

/**
 * 本選：次へ / 完了ボタン処理
 */
function handleMainNext() {
  const totalPages = mainPages.length;

  if (currentMainPageIndex < totalPages - 1) {
    currentMainPageIndex++;
    renderMainPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    finishMain();
  }
}

/**
 * 本選完了 → 決戦（2択）へ
 */
// ----------------------------------------------------
// 💡 決戦（2択勝負）ロジックの改善版
// ----------------------------------------------------

let matchCandidates = [];
let totalRounds = 4; // 各メンバーが対戦する目標回数
let currentRound = 1;

/**
 * 本選完了 → 決戦（2択）へ
 */
function finishMain() {
  if (selectedMainIds.size < 9) {
    alert('9選を決定するため、本選全体で少なくとも9名以上を選択してください！');
    return;
  }

  // 本選通過者に +2 pt (合計3ptスタート)
  selectedMainIds.forEach(id => {
    memberScores.set(id, (memberScores.get(id) || 0) + 2);
  });

  // 本選通過メンバーを抽出
  matchCandidates = allMembers.filter(m => selectedMainIds.has(String(m.id)));

  // 対戦キューの生成
  buildSmartMatchQueue();

  document.getElementById('phase-main').classList.add('hidden');
  document.getElementById('phase-match').classList.remove('hidden');

  showNextMatch();
}

/**
 * 同点同士・対戦経験の少ない者同士を優先してマッチングするキュー生成
 */
function buildSmartMatchQueue() {
  matchQueue = [];
  
  // ポイント順（同点ならランダム）にソート
  const pool = [...matchCandidates].sort((a, b) => {
    const scoreA = memberScores.get(String(a.id)) || 0;
    const scoreB = memberScores.get(String(b.id)) || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return Math.random() - 0.5;
  });

  // 近い順位/ポイント同士でペアを作成
  for (let i = 0; i < pool.length - 1; i += 2) {
    matchQueue.push([pool[i], pool[i + 1]]);
  }
}

function showNextMatch() {
  // キューが空になったら次のラウンドのペアを作るか終了判定
  if (matchQueue.length === 0) {
    if (currentRound < totalRounds) {
      currentRound++;
      buildSmartMatchQueue(); // 次のラウンドのペアを再構築
    } else {
      finishNineSelect(); // 全ラウンド終了
      return;
    }
  }

  document.getElementById('match-remaining').innerText = `${matchQueue.length} (Round ${currentRound}/${totalRounds})`;
  currentMatch = matchQueue.pop();

  const [mA, mB] = currentMatch;

  const imgA = mA.member_images?.find(i => i.is_default)?.image_url || mA.member_images?.[0]?.image_url;
  const imgB = mB.member_images?.find(i => i.is_default)?.image_url || mB.member_images?.[0]?.image_url;

  document.getElementById('match-img-a').src = imgA || 'https://via.placeholder.com/100';
  document.getElementById('match-name-a').innerText = mA.name;

  document.getElementById('match-img-b').src = imgB || 'https://via.placeholder.com/100';
  document.getElementById('match-name-b').innerText = mB.name;
}

function selectMatchWinner(winnerKey) {
  if (!currentMatch) return;

  const winner = winnerKey === 'A' ? currentMatch[0] : currentMatch[1];
  const winnerIdStr = String(winner.id);

  // 勝利ごとに +2 pt 加算（本選突破時点の3ptに差をつける）
  memberScores.set(winnerIdStr, (memberScores.get(winnerIdStr) || 0) + 2);

  showNextMatch();
}

/**
 * PHASE 4: 結果発表
 */
function finishNineSelect() {
  document.getElementById('phase-match').classList.add('hidden');
  document.getElementById('phase-result').classList.remove('hidden');

  const sortedMembers = [...allMembers].sort((a, b) => {
    const scoreA = memberScores.get(String(a.id)) || 0;
    const scoreB = memberScores.get(String(b.id)) || 0;
    return scoreB - scoreA;
  }).slice(0, 9);

  const grid = document.getElementById('result-grid');
  grid.innerHTML = sortedMembers.map((m, index) => {
    const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
    const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/100';

    return `
      <div class="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 group aspect-square">
        <img src="${imgUrl}" class="w-full h-full object-cover">
        <div class="absolute top-1 left-1 bg-black/70 text-pink-400 border border-pink-500/50 text-[10px] font-black w-5 h-5 rounded-md flex items-center justify-center">
          ${index + 1}
        </div>
        <div class="absolute inset-x-0 bottom-0 bg-black/80 text-[9px] font-bold text-slate-100 truncate text-center py-0.5 px-1">
          ${m.name}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * キャプチャ保存
 */
async function downloadNineSelectImage() {
  const targetEl = document.getElementById('result-capture-area');
  if (!targetEl) return;

  try {
    const canvas = await html2canvas(targetEl, {
      backgroundColor: '#020617',
      scale: 2,
      useCORS: true,
      allowTaint: true
    });

    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `推しコレ_好きな顔9選_${dateStr}.png`;
    link.href = image;
    link.click();
  } catch (err) {
    console.error('画像保存エラー:', err);
    alert('画像の保存に失敗しました。');
  }
}
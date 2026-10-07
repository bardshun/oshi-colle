// =========================================================
// グローバル状態管理
// =========================================================
let allMembers = [];           // 全メンバーデータ (fetchCommonMembersで取得)
let activeMembers = [];        // is_hidden を除外した有効メンバー
let selectedMemberIds = [];    // STEP 3で選択されたID
let targetCount = 9;           // 目標人数 (9, 12, 15)
let attrA = 'きれい';
let attrB = 'かわいい';

// 振分け用データ
let classifyIndex = 0;
let classifiedGroupA = [];   // A寄り
let classifiedGroupMid = []; // 中間
let classifiedGroupB = [];   // B寄り

// ソート用
let finalSortedList = [];

// DOM構築後の初期化
document.addEventListener('DOMContentLoaded', async () => {
  // common.js の fetchCommonMembers を利用
  if (typeof fetchCommonMembers === 'function') {
    allMembers = await fetchCommonMembers();
  } else if (window.allCommonMembers) {
    allMembers = window.allCommonMembers;
  }

  // 非表示設定されているメンバーを除外
  activeMembers = allMembers.filter(m => !m.is_hidden);

  // フィルター初期化
  initFilterOptions();
});

// 💡 絞り込み件数の更新関数を追加
function updateFilteredCount() {
  const pref = document.getElementById('filter-prefecture')?.value;
  const cat = document.getElementById('filter-category')?.value;

  const count = activeMembers.filter(m => isMemberMatchFilter(m, pref, cat)).length;
  
  const badge = document.getElementById('filtered-count-badge');
  if (badge) {
    badge.innerText = `対象: ${count}名`;
  }
  return count;
}

// initFilterOptions 内の末尾で一度呼び出して初期表示する
function initFilterOptions() {
  const prefSelect = document.getElementById('filter-prefecture');
  const catSelect = document.getElementById('filter-category');

  if (!activeMembers || activeMembers.length === 0) return;

  const prefs = [...new Set(activeMembers.map(m => m.groups?.prefecture || m.prefecture).filter(Boolean))];
  const cats = [...new Set(activeMembers.map(m => m.groups?.category || m.category).filter(Boolean))];

  prefs.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = `拠点: ${p}`;
    prefSelect.appendChild(opt);
  });

  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    const categoryName = (typeof CATEGORY_NAME_MAP !== 'undefined' && CATEGORY_NAME_MAP[c]) 
      ? CATEGORY_NAME_MAP[c] 
      : c;
    opt.textContent = `区分: ${categoryName}`;
    catSelect.appendChild(opt);
  });

  // 💡 初期件数をセット
  updateFilteredCount();
}

// 💡 ウィザードでSTEP 2を開いた時にも件数を最新化
function goToStep(step) {
  if (step === 2) {
    attrA = document.getElementById('attr-a-input').value.trim() || '属性A';
    attrB = document.getElementById('attr-b-input').value.trim() || '属性B';
    updateFilteredCount(); // 件数バッジ更新
  }
  
  document.getElementById('wizard-step-1').classList.toggle('hidden', step !== 1);
  document.getElementById('wizard-step-2').classList.toggle('hidden', step !== 2);
  document.getElementById('wizard-step-3').classList.toggle('hidden', step !== 3);

  if (step === 3) {
    renderMemberSelectGrid();
  }
}

// =========================================================
// ウィザード操作
// =========================================================
function setPreset(a, b) {
  document.getElementById('attr-a-input').value = a;
  document.getElementById('attr-b-input').value = b;
}

function setTargetCount(count) {
  targetCount = count;
  [9, 12, 15].forEach(num => {
    const btn = document.getElementById(`btn-count-${num}`);
    if (num === count) {
      btn.className = "py-2.5 bg-indigo-600 text-white border border-indigo-500 font-bold text-sm rounded-xl transition";
    } else {
      btn.className = "py-2.5 bg-gray-800 text-gray-300 border border-gray-700 font-bold text-sm rounded-xl transition";
    }
  });
  updateSelectCounter();
}

function goToStep(step) {
  if (step === 2) {
    attrA = document.getElementById('attr-a-input').value.trim() || '属性A';
    attrB = document.getElementById('attr-b-input').value.trim() || '属性B';
  }
  
  document.getElementById('wizard-step-1').classList.toggle('hidden', step !== 1);
  document.getElementById('wizard-step-2').classList.toggle('hidden', step !== 2);
  document.getElementById('wizard-step-3').classList.toggle('hidden', step !== 3);

  if (step === 3) {
    renderMemberSelectGrid();
  }
}

// 絞り込み判定ヘルパー
function isMemberMatchFilter(m, pref, cat) {
  const mPref = m.groups?.prefecture || m.prefecture;
  const mCat = m.groups?.category || m.category;

  const matchPref = !pref || mPref === pref;
  const matchCat = !cat || mCat === cat;
  return matchPref && matchCat;
}

// =========================================================
// メンバー選択＆おまかせ機能
// =========================================================
function renderMemberSelectGrid() {
  const pref = document.getElementById('filter-prefecture').value;
  const cat = document.getElementById('filter-category').value;
  const grid = document.getElementById('member-select-grid');
  
  grid.innerHTML = '';

  const filtered = activeMembers.filter(m => isMemberMatchFilter(m, pref, cat));

  filtered.forEach(m => {
    const isSelected = selectedMemberIds.includes(m.id);
    const card = document.createElement('div');
    card.className = `relative cursor-pointer p-1.5 rounded-xl border transition text-center space-y-1 ${
      isSelected ? 'bg-indigo-950/80 border-indigo-400 ring-2 ring-indigo-500' : 'bg-gray-900 border-gray-800 hover:border-gray-700'
    }`;
    card.onclick = () => toggleSelectMember(m.id);

    // display_image_url を参照
    const imgUrl = m.display_image_url || 'https://via.placeholder.com/150?text=No+Img';

    card.innerHTML = `
      <div class="w-14 h-14 mx-auto rounded-lg overflow-hidden border border-gray-700">
        <img src="${imgUrl}" class="w-full h-full object-cover" alt="${m.name}" />
      </div>
      <p class="text-xs font-bold truncate text-gray-200">${m.name}</p>
    `;
    grid.appendChild(card);
  });

  updateSelectCounter();
}

function toggleSelectMember(id) {
  if (selectedMemberIds.includes(id)) {
    selectedMemberIds = selectedMemberIds.filter(i => i !== id);
  } else {
    if (selectedMemberIds.length >= targetCount) {
      if (window.showToast) showToast(`最大${targetCount}名までしか選択できません`, 'warning');
      return;
    }
    selectedMemberIds.push(id);
  }
  renderMemberSelectGrid();
}

function autoSelectFilteredMembers() {
  const pref = document.getElementById('filter-prefecture').value;
  const cat = document.getElementById('filter-category').value;

  const filtered = activeMembers.filter(m => isMemberMatchFilter(m, pref, cat));

  if (filtered.length < targetCount) {
    if (window.showToast) showToast(`絞り込み対象が${targetCount}名未満です (${filtered.length}名)`, 'warning');
  }

  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  selectedMemberIds = shuffled.slice(0, targetCount).map(m => m.id);
  renderMemberSelectGrid();
}

function clearSelectedMembers() {
  selectedMemberIds = [];
  renderMemberSelectGrid();
}

function updateSelectCounter() {
  const counter = document.getElementById('select-counter');
  if (counter) {
    counter.innerText = `${selectedMemberIds.length} / ${targetCount}人`;
  }
}

// =========================================================
// ゲーム処理 1: 3グループ大まか振分け
// =========================================================
function startSortingGame() {
  if (selectedMemberIds.length < targetCount) {
    if (window.showToast) showToast(`あと${targetCount - selectedMemberIds.length}名選択してください`, 'warning');
    return;
  }

  document.getElementById('btn-classify-a').innerText = attrA;
  document.getElementById('btn-classify-b').innerText = attrB;

  classifiedGroupA = [];
  classifiedGroupMid = [];
  classifiedGroupB = [];
  classifyIndex = 0;

  document.getElementById('phase-wizard').classList.add('hidden');
  document.getElementById('phase-classify').classList.remove('hidden');

  showClassifyStep();
}

function showClassifyStep() {
  if (classifyIndex >= selectedMemberIds.length) {
    startBinarySortPhase();
    return;
  }

  const memberId = selectedMemberIds[classifyIndex];
  const m = activeMembers.find(item => item.id === memberId);

  document.getElementById('classify-progress').innerText = `${classifyIndex + 1} / ${selectedMemberIds.length}`;
  document.getElementById('classify-member-name').innerText = m.name;
  document.getElementById('classify-member-img').src = m.display_image_url || 'https://via.placeholder.com/150?text=No+Img';
  
  // グループ名の取得 (m.groups.name または m.group)
  document.getElementById('classify-member-group').innerText = m.groups?.name || m.group || '';
}

function classifyCurrentMember(groupType) {
  const id = selectedMemberIds[classifyIndex];
  if (groupType === 'A') classifiedGroupA.push(id);
  else if (groupType === 'MID') classifiedGroupMid.push(id);
  else if (groupType === 'B') classifiedGroupB.push(id);

  classifyIndex++;
  showClassifyStep();
}

// =========================================================
// ゲーム処理 2: グループ内 2択ソート (マージソート)
// =========================================================
async function startBinarySortPhase() {
  document.getElementById('phase-classify').classList.add('hidden');
  document.getElementById('phase-compare').classList.remove('hidden');

  const sortedA = await asyncMergeSort(classifiedGroupA);
  const sortedMid = await asyncMergeSort(classifiedGroupMid);
  const sortedB = await asyncMergeSort(classifiedGroupB);

  finalSortedList = [...sortedA, ...sortedMid, ...sortedB];
  showResultPhase();
}

function askUserBinaryChoice(id1, id2) {
  return new Promise(resolve => {
    const m1 = activeMembers.find(m => m.id === id1);
    const m2 = activeMembers.find(m => m.id === id2);

    document.getElementById('compare-attr-target').innerText = attrA;
    document.getElementById('compare-img-1').src = m1.display_image_url || 'https://via.placeholder.com/150?text=No+Img';
    document.getElementById('compare-name-1').innerText = m1.name;

    document.getElementById('compare-img-2').src = m2.display_image_url || 'https://via.placeholder.com/150?text=No+Img';
    document.getElementById('compare-name-2').innerText = m2.name;

    document.getElementById('btn-compare-1').onclick = () => resolve(-1);
    document.getElementById('btn-compare-2').onclick = () => resolve(1);
  });
}

async function asyncMergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = await asyncMergeSort(arr.slice(0, mid));
  const right = await asyncMergeSort(arr.slice(mid));

  let result = [];
  let l = 0, r = 0;

  while (l < left.length && r < right.length) {
    const choice = await askUserBinaryChoice(left[l], right[r]);
    if (choice <= 0) {
      result.push(left[l]);
      l++;
    } else {
      result.push(right[r]);
      r++;
    }
  }

  return [...result, ...left.slice(l), ...right.slice(r)];
}

// =========================================================
// ゲーム処理 3: ジグザグ結果表示
// =========================================================
function showResultPhase() {
  document.getElementById('phase-compare').classList.add('hidden');
  document.getElementById('phase-result').classList.remove('hidden');

  document.getElementById('res-attr-a').innerText = attrA;
  document.getElementById('res-attr-b').innerText = attrB;

  const container = document.getElementById('zigzag-container');
  const cards = container.querySelectorAll('.zigzag-card');
  cards.forEach(c => c.remove());

  finalSortedList.forEach((id, index) => {
    const m = activeMembers.find(item => item.id === id);
    const total = finalSortedList.length;

    const isTop = index === 0;
    const isBottom = index === total - 1;

    let alignClass = "mx-auto w-full max-w-xs";
    if (!isTop && !isBottom) {
      alignClass = (index % 2 === 1) ? "mr-auto w-4/5" : "ml-auto w-4/5";
    }

    let borderClass = "border-gray-800 bg-gray-900/90";
    if (isTop) borderClass = "border-2 border-sky-400 bg-sky-950/40 shadow-sky-900/30 shadow-lg";
    else if (isBottom) borderClass = "border-2 border-rose-400 bg-rose-950/40 shadow-rose-900/30 shadow-lg";

    // 所属グループ名または属性の表示
    const tagText = m.groups?.name || m.group || m.category || '';

    const card = document.createElement('div');
    card.className = `zigzag-card relative z-10 p-2.5 rounded-2xl border ${borderClass} ${alignClass} flex items-center gap-3 transition transform hover:scale-102`;

    card.innerHTML = `
      <div class="relative w-12 h-12 rounded-xl overflow-hidden border border-gray-700 shrink-0">
        <img src="${m.display_image_url || 'https://via.placeholder.com/150?text=No+Img'}" class="w-full h-full object-cover" alt="${m.name}" />
        ${isTop ? '<span class="absolute top-0 left-0 text-xs">👑</span>' : ''}
        ${isBottom ? '<span class="absolute top-0 left-0 text-xs">🌸</span>' : ''}
      </div>
      <div class="flex-1 min-w-0 text-left">
        <div class="flex items-center gap-1.5">
          <span class="text-xs font-extrabold text-gray-400">#${index + 1}</span>
          <p class="text-sm font-bold text-white truncate">${m.name}</p>
        </div>
        ${tagText ? `<span class="inline-block mt-0.5 px-2 py-0.5 bg-gray-800 text-gray-300 text-[10px] rounded-md border border-gray-700 truncate">${tagText}</span>` : ''}
      </div>
    `;

    container.appendChild(card);
  });
}

// 💡 結果画面を画像（PNG）としてダウンロードする関数
async function downloadResultImage() {
  const captureArea = document.getElementById('result-capture-area');
  const btn = document.getElementById('download-image-btn');

  if (!captureArea) return;

  // ボタンをローディング表示に変更
  const originalText = btn.innerHTML;
  btn.innerHTML = `<span>⏳</span> 画像を生成中...`;
  btn.disabled = true;

  try {
    // html2canvas の実行設定
    const canvas = await html2canvas(captureArea, {
      backgroundColor: '#030712', // bg-gray-950 の背景色
      scale: 2,                   // 高解像度（Retina対応）で保存
      useCORS: true,              // 外部画像の読み込みを許可
      allowTaint: false,
      logging: false
    });

    // 画像データの生成 (PNG)
    const dataUrl = canvas.toDataURL('image/png');

    // ファイル名の生成 (例: 推し一直線_きれい_vs_かわいい_20261007.png)
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const fileName = `推し一直線_${attrA}_vs_${attrB}_${dateStr}.png`;

    // ダウンロード用の一時リンクを作成して発火
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (window.showToast) {
      showToast('画像を保存しました！', 'success');
    }
  } catch (err) {
    console.error('画像生成エラー:', err);
    if (window.showToast) {
      showToast('画像の生成に失敗しました', 'error');
    } else {
      alert('画像の保存に失敗しました');
    }
  } finally {
    // ボタン表示を元に戻す
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

function resetToWizard() {
  selectedMemberIds = [];
  document.getElementById('phase-result').classList.add('hidden');
  document.getElementById('phase-wizard').classList.remove('hidden');
  goToStep(1);
}
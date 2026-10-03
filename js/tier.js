// 初期ランク定義（L, S, A, B, C）
let defaultTiers = [
  { id: 'tier-L', name: 'L', color: '#ffffff', textColor: '#000000' }, // 白（黒文字）
  { id: 'tier-S', name: 'S', color: '#ff4136', textColor: '#ffffff' }, // 赤
  { id: 'tier-A', name: 'A', color: '#ff851b', textColor: '#ffffff' }, // オレンジ
  { id: 'tier-B', name: 'B', color: '#ffdc00', textColor: '#000000' }, // 黄（黒文字）
  { id: 'tier-C', name: 'C', color: '#2ecc40', textColor: '#ffffff' }  // 黄緑
];

let allMembers = [];
let memberPositions = {}; // { memberId: tierId }
let wallCount = 0; // ランク上に生成された「壁」のカウンター
let selectedMemberData = null; // タップ選択中のアイテム情報 { id: '...' }

document.addEventListener('DOMContentLoaded', async () => {
  renderTierBoard();
  await loadTierMembers();
  loadGroupsFilter();
});

// 1. Tierボードのレンダリング
function renderTierBoard() {
  const container = document.getElementById('tier-container');
  if (!container) {
    console.error('tier-container が見つかりません');
    return;
  }
  container.innerHTML = defaultTiers.map((tier) => `
    <div id="${tier.id}" class="tier-row flex border border-gray-800 rounded-lg overflow-hidden bg-gray-900 min-h-[90px]">
      
      <!-- ランクヘッダー -->
      <div class="w-20 sm:w-24 flex-shrink-0 flex flex-col justify-between p-2 select-none text-center relative group" 
           style="background-color: ${tier.color}; color: ${tier.textColor};">
        
        <input type="text" value="${tier.name}" onchange="updateTierName('${tier.id}', this.value)" 
               class="w-full bg-transparent font-black text-xl sm:text-2xl text-center focus:outline-none focus:bg-black/20 rounded" 
               style="color: ${tier.textColor};">

        <div class="flex justify-between items-center text-[10px] opacity-70 group-hover:opacity-100 transition">
          <input type="color" value="${tier.color}" onchange="updateTierColor('${tier.id}', this.value)" 
                 class="w-5 h-5 cursor-pointer bg-transparent border-0 p-0">
          <button onclick="deleteTierRow('${tier.id}')" class="hover:text-red-500 font-bold px-1">✕</button>
        </div>
      </div>

      <!-- ドロップエリア -->
      <div id="drop-${tier.id}" ondrop="dropToTier(event, '${tier.id}')" ondragover="allowDrop(event)" onclick="handleTierClick('${tier.id}')" 
           class="tier-content flex-1 p-2 flex flex-wrap gap-2 items-center bg-gray-900/60 min-h-[90px] cursor-pointer">
      </div>
    </div>
  `).join('');
}

// 2. Supabaseからメンバー＆画像取得
async function loadTierMembers() {
  console.log('メンバーデータの読み込みを開始します...');
  const { data, error } = await supabase
    .from('members')
    .select(`*, groups(name), member_images(image_url, is_default)`)
    .order('name');

  if (error) {
    console.error('メンバー取得失敗:', error);
    return;
  }

  console.log(`メンバーデータ取得完了: ${data ? data.length : 0}件`);
  allMembers = data || [];
  renderPool();
}

// 3. グループフィルターの初期化
async function loadGroupsFilter() {
  const { data, error } = await supabase.from('groups').select('*').order('name');
  if (error) {
    console.error('グループフィルター取得失敗:', error);
    return;
  }
  const select = document.getElementById('tier-group-filter');
  if (data && select) {
    data.forEach(g => {
      select.innerHTML += `<option value="${g.id}">${g.name}</option>`;
    });
  }
}

// 4. プールエリアの描画（無限「壁」カードを常時先頭に配置）
function renderPool() {
  const poolEl = document.getElementById('member-pool');
  if (!poolEl) return;
  const filterGroup = document.getElementById('tier-group-filter')?.value;

  const unplaced = allMembers.filter(m => {
    const isPlaced = !!memberPositions[m.id];
    const matchGroup = !filterGroup || String(m.group_id) === filterGroup;
    return !isPlaced && matchGroup;
  });

  const countEl = document.getElementById('pool-count');
  if (countEl) countEl.innerText = `${unplaced.length}名`;

  const isWallSelected = selectedMemberData && selectedMemberData.id === 'wall';

  // 1番目に常時「無限の壁カード」を置く（タップ選択対応）
  const wallCardHtml = `
    <div id="wall-template" draggable="true" 
         ondragstart="dragStart(event, 'wall')" 
         onclick="handleCardClick(event, 'wall')"
         class="w-16 h-20 sm:w-20 sm:h-24 bg-black text-white border-2 ${isWallSelected ? 'border-pink-500 ring-4 ring-pink-500/80 scale-105 z-10 shadow-lg shadow-pink-500/30' : 'border-gray-600 hover:border-white'} rounded-lg flex flex-col items-center justify-center cursor-pointer transition flex-shrink-0 select-none shadow">
      <span class="text-xl sm:text-2xl font-black pointer-events-none">壁</span>
      <span class="text-[9px] text-gray-400 mt-1 pointer-events-none">無限追加</span>
    </div>
  `;

  const memberCardsHtml = unplaced.map(m => createMemberCardHtml(m)).join('');
  poolEl.innerHTML = wallCardHtml + memberCardsHtml;
}

// メンバーカードHTML生成（タップ選択・強調対応）
function createMemberCardHtml(m) {
  const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
  const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/100?text=No+Img';
  const isSelected = selectedMemberData && selectedMemberData.id === String(m.id);

  return `
    <div id="card-${m.id}" draggable="true" 
         ondragstart="dragStart(event, '${m.id}')" 
         onclick="handleCardClick(event, '${m.id}')"
         class="w-16 h-20 sm:w-20 sm:h-24 bg-gray-800 rounded-lg overflow-hidden border ${isSelected ? 'border-pink-500 ring-4 ring-pink-500/80 scale-105 z-10 shadow-lg shadow-pink-500/30' : 'border-gray-700'} cursor-pointer hover:border-pink-500 flex flex-col flex-shrink-0 select-none shadow transition duration-150">
      <img src="${imgUrl}" alt="${m.name}" class="w-full h-12 sm:h-16 object-cover pointer-events-none">
      <div class="p-0.5 bg-gray-800 flex-1 flex items-center justify-center">
        <span class="text-[10px] text-gray-200 font-bold truncate text-center px-0.5 pointer-events-none">${m.name}</span>
      </div>
    </div>
  `;
}

// 5. ドラッグ＆ドロップ処理
function allowDrop(e) {
  e.preventDefault();
}

function dragStart(e, itemData) {
  e.dataTransfer.setData('text/plain', itemData);
}

// 5. ドラッグ＆ドロップ処理（割り込み配置対応版）
function dropToTier(e, tierId) {
  e.preventDefault();
  const data = e.dataTransfer.getData('text/plain');
  if (!data) return;

  const targetDropZone = document.getElementById(`drop-${tierId}`);
  if (!targetDropZone) return;

  // 💡 ドロップ位置（どのカードの手前に落とされたか）を判定するロジック
  const targetCard = e.target.closest('#member-pool > div, .tier-content > div');
  
  // 配置するエレメントの取得または生成
  let elementToAppend = null;

  if (data === 'wall') {
    // 新しい壁を生成
    wallCount++;
    const newWallId = `wall-placed-${wallCount}`;
    const newWallEl = document.createElement('div');
    newWallEl.id = newWallId;
    newWallEl.draggable = true;
    newWallEl.setAttribute('ondragstart', `dragStart(event, '${newWallId}')`);
    newWallEl.className = "w-16 h-20 sm:w-20 sm:h-24 bg-black text-white border-2 border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:border-red-500 transition flex-shrink-0 select-none shadow relative group";
    newWallEl.innerHTML = `
      <span class="text-xl sm:text-2xl font-black">壁</span>
      <button onclick="removeWall('${newWallId}')" class="absolute top-1 right-1 text-xs text-gray-500 hover:text-red-500 font-bold opacity-0 group-hover:opacity-100 transition">✕</button>
    `;
    elementToAppend = newWallEl;
  } else if (data.startsWith('wall-placed-')) {
    // 移動する既存の壁
    elementToAppend = document.getElementById(data);
  } else {
    // 通常のメンバーカード
    memberPositions[data] = tierId;
    elementToAppend = document.getElementById(`card-${data}`);
  }

  if (!elementToAppend) return;

  // 💡 ドロップ先が特定のカードの上だった場合は手前に挿入、それ以外は末尾に追加
  if (targetCard && targetDropZone.contains(targetCard) && targetCard !== elementToAppend) {
    targetDropZone.insertBefore(elementToAppend, targetCard);
  } else {
    targetDropZone.appendChild(elementToAppend);
  }

  renderPool();
}

function dropToPool(e) {
  e.preventDefault();
  const data = e.dataTransfer.getData('text/plain');
  if (!data) return;

  // 壁をプールへ戻した場合は削除する
  if (data.startsWith('wall-placed-')) {
    removeWall(data);
    return;
  }

  delete memberPositions[data];
  renderPool();
}

// ランク上の壁を削除
function removeWall(wallId) {
  const wallEl = document.getElementById(wallId);
  if (wallEl) wallEl.remove();
}

// 6. ランクの動的追加・編集・削除
function addTierRow() {
  const newId = `tier-${Date.now()}`;
  defaultTiers.push({ id: newId, name: 'NEW', color: '#7f8c8d', textColor: '#ffffff' });
  renderTierBoard();
  restoreCardPositions();
}

function updateTierName(tierId, newName) {
  const t = defaultTiers.find(x => x.id === tierId);
  if (t) t.name = newName;
}

function updateTierColor(tierId, newColor) {
  const t = defaultTiers.find(x => x.id === tierId);
  if (t) {
    t.color = newColor;
    const rgb = parseInt(newColor.substring(1), 16);
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >>  8) & 0xff;
    const b = (rgb >>  0) & 0xff;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    t.textColor = luma > 128 ? '#000000' : '#ffffff';
    
    renderTierBoard();
    restoreCardPositions();
  }
}

function deleteTierRow(tierId) {
  Object.keys(memberPositions).forEach(mId => {
    if (memberPositions[mId] === tierId) delete memberPositions[mId];
  });

  defaultTiers = defaultTiers.filter(x => x.id !== tierId);
  renderTierBoard();
  renderPool();
}

// ランク削除時などの位置復元用
function restoreCardPositions() {
  Object.keys(memberPositions).forEach(mId => {
    const tierId = memberPositions[mId];
    const cardEl = document.getElementById(`card-${mId}`);
    const dropZone = document.getElementById(`drop-${tierId}`);
    if (cardEl && dropZone && !dropZone.contains(cardEl)) {
      dropZone.appendChild(cardEl);
    }
  });
  updateCardHighlightStyles();
}


function filterPoolMembers() {
  renderPool();
}

// 7. Tier表 全体プレビュー ＆ 画像保存処理 (横スクロール＆1行10固定対応版)
window.openTierPreviewModal = function() {
  console.log('Tier表プレビューモーダルを開きます');
  const exportTarget = document.getElementById('tier-export-target');
  if (!exportTarget) {
    console.error('tier-export-target エレメントが見つかりません');
    return;
  }

  // ドロップゾーンから現在のカード・壁のノードをクローンして綺麗に描画
  exportTarget.innerHTML = `
    <div class="text-center pb-2 mb-3 border-b border-gray-800">
      <h2 class="text-xl font-black text-pink-500 tracking-wider">OFFICIAL TIER LIST</h2>
    </div>
    <div class="space-y-2">
      ${defaultTiers.map(tier => {
        const dropZone = document.getElementById(`drop-${tier.id}`);
        const clonedChildrenHtml = dropZone ? dropZone.innerHTML : '';

        return `
          <div class="flex items-stretch bg-gray-950 border border-gray-800 rounded-lg overflow-hidden min-h-[80px]">
            <!-- ランクヘッダー (左端固定) -->
            <div class="w-20 sm:w-24 flex items-center justify-center font-black text-xl sm:text-2xl border-r border-gray-800 shrink-0 text-center p-2 select-none sticky left-0 z-10"
                 style="background-color: ${tier.color}; color:${tier.textColor};">
              ${tier.name}
            </div>

            <!-- ドロップエリア (折り返しなし・1行で10個分以上の最小幅確保・単体横スクロール) -->
            <div class="flex-1 p-2 flex flex-nowrap items-center gap-2 bg-gray-900/80 overflow-x-auto min-w-[800px] custom-scrollbar">
              ${clonedChildrenHtml || '<span class="text-xs text-gray-600 pl-2">なし</span>'}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // 不要な削除ボタンや編集用UIの非表示処理（クローン要素内）
  exportTarget.querySelectorAll('button').forEach(btn => btn.style.display = 'none');

  const modal = document.getElementById('tier-preview-modal');
  if (modal) modal.classList.remove('hidden');
};

window.closeTierPreviewModal = function() {
  const modal = document.getElementById('tier-preview-modal');
  if (modal) modal.classList.add('hidden');
};

// html2canvasによる高画質PNG画像出力処理
window.downloadTierImage = async function() {
  const target = document.getElementById('tier-export-target');
  if (!target) return;

  console.log('Tier表画像の生成を開始します...');
  try {
    const canvas = await html2canvas(target, {
      backgroundColor: '#111827', // bg-gray-900
      scale: 2 // 高解像度化
    });

    const link = document.createElement('a');
    link.download = `tier-list_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    console.log('Tier表画像のダウンロードが完了しました');
  } catch (err) {
    console.error('画像生成エラー:', err);
    alert('画像の保存に失敗しました: ' + (err.message || 'エラーが発生しました'));
  }
};

// 共通の配置処理コアロジック（ドラッグ＆タップ共通）
function executePlacement(data, tierId, targetCardElement) {
  const targetDropZone = document.getElementById(`drop-${tierId}`);
  if (!targetDropZone) return;

  let elementToAppend = null;

  if (data === 'wall') {
    // 未配置プールからの「壁」新規追加
    wallCount++;
    const newWallId = `wall-placed-${wallCount}`;
    const newWallEl = document.createElement('div');
    newWallEl.id = newWallId;
    newWallEl.draggable = true;
    newWallEl.setAttribute('ondragstart', `dragStart(event, '${newWallId}')`);
    newWallEl.setAttribute('onclick', `handleCardClick(event, '${newWallId}')`);
    newWallEl.className = "w-16 h-20 sm:w-20 sm:h-24 bg-black text-white border-2 border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-red-500 transition flex-shrink-0 select-none shadow relative group";
    newWallEl.innerHTML = `
      <span class="text-xl sm:text-2xl font-black pointer-events-none">壁</span>
      <button onclick="removeWall('${newWallId}')" class="absolute top-1 right-1 text-xs text-gray-500 hover:text-red-500 font-bold opacity-0 group-hover:opacity-100 transition">✕</button>
    `;
    elementToAppend = newWallEl;
  } else if (data.startsWith('wall-placed-')) {
    // ランク上に配置済みの壁の移動
    elementToAppend = document.getElementById(data);
  } else {
    // メンバーカードの移動
    memberPositions[data] = tierId;
    elementToAppend = document.getElementById(`card-${data}`);
  }

  if (!elementToAppend) return;

  // 💡 割り込み判定：targetCardElement が存在しドロップゾーン内にあれば直前に挿入、なければ末尾追加
  if (targetCardElement && targetDropZone.contains(targetCardElement) && targetCardElement !== elementToAppend) {
    targetDropZone.insertBefore(elementToAppend, targetCardElement);
  } else {
    targetDropZone.appendChild(elementToAppend);
  }
}

// ドラッグ＆ドロップ処理（PC操作用）
function dropToTier(e, tierId) {
  e.preventDefault();
  const data = e.dataTransfer.getData('text/plain');
  if (!data) return;

  const targetCard = e.target.closest('#member-pool > div, .tier-content > div');
  executePlacement(data, tierId, targetCard);

  selectedMemberData = null;
  renderPool();
  updateCardHighlightStyles();
}

// カード・壁タップ時の処理 (選択・移動・割り込み統合版)
function handleCardClick(e, rawId) {
  e.stopPropagation(); // 親要素へのイベント伝播を防止

  const clickedStr = String(rawId);

  // 1. すでに何か選択されている状態で「別のカード／壁」をタップした場合 ➔ その手前に割り込み配置！
  if (selectedMemberData && selectedMemberData.id !== clickedStr) {
    // タップされた要素（メンバーカード or 壁）を確定
    const targetElement = document.getElementById(`card-${clickedStr}`) || document.getElementById(clickedStr);
    const targetDropZone = targetElement ? targetElement.parentElement : null;

    if (targetDropZone && targetDropZone.id.startsWith('drop-')) {
      const tierId = targetDropZone.id.replace('drop-', '');
      
      // 選択中の要素を、タップされた要素(targetElement)の直前に割り込み配置
      executePlacement(selectedMemberData.id, tierId, targetElement);

      selectedMemberData = null;
      renderPool();
      updateCardHighlightStyles();
      return;
    }
  }

  // 2. 選択トグル（同じものを押したら解除、別なら選択）
  if (selectedMemberData && selectedMemberData.id === clickedStr) {
    selectedMemberData = null;
  } else {
    selectedMemberData = { id: clickedStr };
  }

  renderPool();
  updateCardHighlightStyles();
}

// ランク背景（空きスペース）タップ時の処理 ➔ 末尾に配置
function handleTierClick(tierId) {
  if (!selectedMemberData) return;

  executePlacement(selectedMemberData.id, tierId, null);

  selectedMemberData = null;
  renderPool();
  updateCardHighlightStyles();
}

// 💡 位置を壊さずに「選択ハイライト（ピンク枠）」だけを更新するヘルパー関数
function updateCardHighlightStyles() {
  // すべてのメンバーカードの枠線スタイルを同期
  allMembers.forEach(m => {
    const cardEl = document.getElementById(`card-${m.id}`);
    if (!cardEl) return;

    const isSelected = selectedMemberData && selectedMemberData.id === String(m.id);
    if (isSelected) {
      cardEl.className = "w-16 h-20 sm:w-20 sm:h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-pink-500 ring-4 ring-pink-500/80 scale-105 z-10 shadow-lg shadow-pink-500/30 cursor-pointer flex flex-col flex-shrink-0 select-none transition duration-150";
    } else {
      cardEl.className = "w-16 h-20 sm:w-20 sm:h-24 bg-gray-800 rounded-lg overflow-hidden border border-gray-700 cursor-pointer hover:border-pink-500 flex flex-col flex-shrink-0 select-none shadow transition duration-150";
    }
  });

  // 設置された「壁」のハイライト状態も同期
  document.querySelectorAll('[id^="wall-placed-"]').forEach(wallEl => {
    const isSelected = selectedMemberData && selectedMemberData.id === wallEl.id;
    if (isSelected) {
      wallEl.className = "w-16 h-20 sm:w-20 sm:h-24 bg-black text-white border-2 border-pink-500 ring-4 ring-pink-500/80 scale-105 z-10 shadow-lg shadow-pink-500/30 rounded-lg flex flex-col items-center justify-center cursor-pointer transition flex-shrink-0 select-none relative group";
    } else {
      wallEl.className = "w-16 h-20 sm:w-20 sm:h-24 bg-black text-white border-2 border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-red-500 transition flex-shrink-0 select-none shadow relative group";
    }
  });
}
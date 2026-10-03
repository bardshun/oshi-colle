// 初期ランク定義（L, S, A, B, C）
let defaultTiers = [
  { id: 'tier-L', name: 'L', color: '#ffffff', textColor: '#000000' }, // 白（黒文字）
  { id: 'tier-S', name: 'S', color: '#ff4136', textColor: '#ffffff' }, // 赤
  { id: 'tier-A', name: 'A', color: '#ff851b', textColor: '#ffffff' }, // オレンジ
  { id: 'tier-B', name: 'B', color: '#ffdc00', textColor: '#000000' }, // 黄（黒文字）
  { id: 'tier-C', name: 'C', color: '#2ecc40', textColor: '#ffffff' }  // 黄緑
];

let allMembers = [];
let allGroups = [];
let memberPositions = {}; // { memberId: tierId }
let wallCount = 0; // ランク上に生成された「壁」のカウンター
let selectedMemberData = null; // タップ選択中のアイテム情報 { id: '...' }
let currentSortKey = 'ruby'; 
let isSortAsc = true; // true: 昇順 (▲) / false: 降順 (▼)
let saveTimeout = null;
let isTierUIInitialized = false;
let currentEditingTierId = null;

document.addEventListener('DOMContentLoaded', async () => {
  renderTierBoard();     // ボード初期表示
  await loadTierMembers(); // メンバー・グループ取得 ➔ フィルター初期化 ➔ プール描画を一括実行
  loadDraftFromLocalStorage();
  loadUIPreferences();
  isTierUIInitialized = true;
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

// 2. Supabaseからメンバー＆グループ＆画像情報を一括取得
async function loadTierMembers() {
  console.log('データの読み込みを開始します...');

  try {
    // ログインユーザー情報の取得
    const user = (await supabase.auth.getUser())?.data?.user;

    // 💡 members, groups, user_member_settings を並行取得
    const [membersRes, groupsRes, settingsRes] = await Promise.all([
      supabase
        .from('members')
        .select(`*, groups(id, name, prefecture, category), member_images(image_url, is_default)`)
        .order('name'),
      supabase
        .from('groups')
        .select(`*`)
        .order('name'),
      // ログイン済みの場合のみ設定テーブルを取得（未ログイン時は null）
      user 
        ? supabase.from('user_member_settings').select('member_id, is_hidden').eq('user_id', user.id)
        : Promise.resolve({ data: [] })
    ]);

    if (membersRes.error) console.error('メンバー取得エラー:', membersRes.error);
    if (groupsRes.error) console.error('グループ取得エラー:', groupsRes.error);
    if (settingsRes.error) console.error('表示設定取得エラー:', settingsRes.error);

    const rawMembers = membersRes.data || [];
    allGroups = groupsRes.data || [];

    // 💡 非表示設定（is_hidden）を Map 化
    const settingsMap = new Map((settingsRes.data || []).map(s => [String(s.member_id), s.is_hidden]));

    // 💡 is_hidden が true のメンバーを最初から除外して allMembers に格納
    allMembers = rawMembers.filter(m => {
      const isHidden = settingsMap.get(String(m.id)) ?? false;
      return !isHidden; // 表示対象（is_hidden === false）のみ残す
    });

    console.log(`取得完了: メンバー ${allMembers.length}件（非表示除外済）/ グループ ${allGroups.length}件`);

    // 取得完了後にフィルターの選択肢（拠点・グループ・区分）を初期化
    setupTierFilters(allMembers, allGroups);

    // プールエリアの描画
    renderPool();

  } catch (err) {
    console.error('データ読込例外エラー:', err);
  }
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

// 4. プールエリアの描画（無限「壁」カードを常時先頭に配置＋拠点・区分フィルター対応）
/**
 * ソートボタンのタップイベント処理
 * @param {string} key - 'ruby' または 'group'
 */
window.toggleSort = function(key) {
  if (currentSortKey === key) {
    // 同じボタンを押し込み ➔ 昇順/降順を反転
    isSortAsc = !isSortAsc;
  } else {
    // 別のボタンを押し込み ➔ キーを変更して昇順からスタート
    currentSortKey = key;
    isSortAsc = true;
  }

  // ボタンの見た目（矢印アイコン等）を更新
  updateSortUI();

  // プール領域を再描画
  renderPool();
};

/**
 * ソートボタンのアイコンや表示スタイルを更新
 */
function updateSortUI() {
  const rubyBtn = document.getElementById('sort-ruby-btn');
  const groupBtn = document.getElementById('sort-group-btn');
  const rubyIcon = document.getElementById('sort-ruby-icon');
  const groupIcon = document.getElementById('sort-group-icon');

  const arrow = isSortAsc ? '▲' : '▼';

  if (rubyIcon && groupIcon) {
    rubyIcon.textContent = currentSortKey === 'ruby' ? arrow : '▼';
    groupIcon.textContent = currentSortKey === 'group' ? arrow : '▼';
  }

  // アクティブなボタンのハイライト
  if (rubyBtn && groupBtn) {
    if (currentSortKey === 'ruby') {
      rubyBtn.classList.add('border-pink-500', 'text-pink-400');
      groupBtn.classList.remove('border-pink-500', 'text-pink-400');
    } else {
      groupBtn.classList.add('border-pink-500', 'text-pink-400');
      rubyBtn.classList.remove('border-pink-500', 'text-pink-400');
    }
  }
}

/**
 * プール描画関数 (ソート適用版)
 */
function renderPool() {
  const poolEl = document.getElementById('member-pool');
  if (!poolEl) return;

  const selectedBranch = document.getElementById('tier-branch-filter')?.value || '';
  const selectedGroup = document.getElementById('tier-group-filter')?.value || '';
  const selectedCategory = document.getElementById('tier-category-filter')?.value || '';

  const groupMap = new Map(allGroups.map(g => [String(g.id), g]));

  // 1. 未配置かつフィルターに合致するメンバーを抽出
  let unplaced = allMembers.filter(m => {
    if (memberPositions[m.id]) return false;

    const group = m.group_id ? groupMap.get(String(m.group_id)) : null;

    if (selectedBranch) {
      const matchMemberBranch = m.prefecture === selectedBranch;
      const matchGroupBranch = group && group.prefecture === selectedBranch;
      if (!matchMemberBranch && !matchGroupBranch) return false;
    }

    if (selectedGroup) {
      if (selectedGroup === 'unassigned') {
        if (m.group_id) return false;
      } else {
        if (String(m.group_id) !== selectedGroup) return false;
      }
    }

    if (selectedCategory) {
      const matchMemberCategory = m.category === selectedCategory;
      const matchGroupCategory = group && group.category === selectedCategory;
      if (!matchMemberCategory && !matchGroupCategory) return false;
    }

    return true;
  });

  // 2. 💡 ソート処理の適用
  unplaced.sort((a, b) => {
    let valA = '';
    let valB = '';

    if (currentSortKey === 'ruby') {
      // ふりがな（なければ名前）で比較
      valA = a.ruby || a.name || '';
      valB = b.ruby || b.name || '';
    } else if (currentSortKey === 'group') {
      // グループ名（なければ「無所属」）で比較
      const groupA = a.group_id ? groupMap.get(String(a.group_id)) : null;
      const groupB = b.group_id ? groupMap.get(String(b.group_id)) : null;
      valA = groupA ? (groupA.name || '') : 'んんん'; // 無所属を一番最後に持ってくるため「んんん」を代替値に
      valB = groupB ? (groupB.name || '') : 'んんん';
    }

    const comp = valA.localeCompare(valB, 'ja');
    return isSortAsc ? comp : -comp;
  });

  // 3. 件数表示
  const countEl = document.getElementById('pool-count');
  if (countEl) countEl.innerText = `${unplaced.length}名`;

  // 4. カードDOM生成（壁カード ＋ メンバーカード）
  const isWallSelected = selectedMemberData && selectedMemberData.id === 'wall';
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
  saveDraftToLocalStorage();
  saveUIPreferences();
}

// メンバーカードHTML生成（画像サイズ維持＆高さ自動調整による見切れ完全防止版）
function createMemberCardHtml(m) {
  const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
  const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/100?text=No+Img';
  const isSelected = selectedMemberData && selectedMemberData.id === String(m.id);

  return `
    <div id="card-${m.id}" draggable="true" 
         ondragstart="dragStart(event, '${m.id}')" 
         onclick="handleCardClick(event, '${m.id}')"
         class="w-16 sm:w-20 h-auto bg-gray-800 rounded-lg overflow-hidden border ${isSelected ? 'border-2 border-pink-500 ring-4 ring-pink-500/80 scale-105 z-10 shadow-lg shadow-pink-500/30' : 'border-gray-700'} cursor-pointer hover:border-pink-500 flex flex-col flex-shrink-0 select-none shadow transition duration-150">
      <!-- 1. 画像エリア（元のサイズに固定） -->
      <img src="${imgUrl}" alt="${m.name}" class="w-full h-12 sm:h-16 object-cover pointer-events-none block shrink-0">
      
      <!-- 2. 名前エリア（上下パディングをしっかり取り、文字が収まる高さを確保） -->
      <div class="px-0.5 py-1.5 bg-gray-800 flex items-center justify-center shrink-0">
        <span class="text-[9px] sm:text-[10px] text-gray-200 font-bold truncate text-center block w-full pointer-events-none leading-tight">
          ${m.name}
        </span>
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
  // 1. ランク枠を再生成
  renderTierBoard();
  // 2. カード（HTML要素）を再描画・生成 💡これが抜けていました
  renderPool();
  // 🔍 デバッグログを追加
  console.log('配置情報 (memberPositions):', memberPositions);
  console.log('取得できたカード要素数:', document.querySelectorAll('.member-card').length); // クラス名は実際のカードのクラス名に合わせて変更してください
  // 3. 各カードを記憶されている位置（Tier枠またはプール）へ再配置
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
  // 削除対象ランクにいたメンバーを未配置（プール）に戻す
  Object.keys(memberPositions).forEach(mId => {
    if (memberPositions[mId] === tierId) delete memberPositions[mId];
  });
  defaultTiers = defaultTiers.filter(x => x.id !== tierId);
  // 1. ランク枠を再生成
  renderTierBoard();
  // 2. カード（HTML要素）を再描画・生成
  renderPool();
  // 3. 各カードを記憶されている位置へ再配置
  restoreCardPositions();
}

// ランク削除時などの位置復元用
function restoreCardPositions() {
  Object.keys(memberPositions).forEach(mId => {
    const tierId = memberPositions[mId];
    let cardEl = document.getElementById(`card-${mId}`);
    const dropZone = document.getElementById(`drop-${tierId}`);

    // 💡 cardEl が存在しない（Tier再描画で消えた）場合、カードを再生成して復元
    if (!cardEl && dropZone) {
      // allMembers (またはお使いのメンバー全件配列変数) から対象メンバーを取得
      const member = allMembers?.find(m => String(m.id) === String(mId));
      if (member && typeof createMemberCardHtml === 'function') {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = createMemberCardHtml(member);
        cardEl = tempDiv.firstElementChild;
      }
    }

    // ドロップゾーンが存在し、カードがまだ入っていない場合に挿入
    if (cardEl && dropZone && !dropZone.contains(cardEl)) {
      dropZone.appendChild(cardEl);
    }
  });

  updateCardHighlightStyles();
  saveDraftToLocalStorage();
}

/**
 * フィルター・ソート領域のアコーディオン開閉トグル
 */
window.toggleFilterAccordion = function() {
  const content = document.getElementById('filter-accordion-content');
  const arrow = document.getElementById('accordion-arrow');
  const btn = document.getElementById('toggle-filter-btn');

  if (!content) return;

  const isHidden = content.classList.contains('hidden');

  if (isHidden) {
    // 開く
    content.classList.remove('hidden');
    if (arrow) arrow.textContent = '▲';
    if (btn) btn.classList.add('border-pink-500/50');
  } else {
    // 閉じる
    content.classList.add('hidden');
    if (arrow) arrow.textContent = '▼';
    if (btn) btn.classList.remove('border-pink-500/50');
  }
  saveUIPreferences();
};

/**
 * フィルター条件が1つ以上選択されている場合、トグルボタンにピンクのドット（バッジ）を表示
 */
function updateFilterActiveBadge() {
  const branchVal = document.getElementById('tier-branch-filter')?.value || '';
  const groupVal = document.getElementById('tier-group-filter')?.value || '';
  const categoryVal = document.getElementById('tier-category-filter')?.value || '';
  const badge = document.getElementById('filter-status-badge');

  if (!badge) return;

  // 何らかのフィルターが選択されていればバッジを表示
  if (branchVal || groupVal || categoryVal) {
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

window.filterPoolMembers = function() {
  updateFilterActiveBadge();
  renderPool();
};

// 7. Tier表 全体プレビュー ＆ 画像保存処理 (出力時は画像のみカードに変換版)
window.openTierPreviewModal = function() {
  console.log('Tier表プレビューモーダルを開きます');
  const exportTarget = document.getElementById('tier-export-target');
  if (!exportTarget) {
    console.error('tier-export-target エレメントが見つかりません');
    return;
  }

  // 外枠の指定
  exportTarget.className = "w-max min-w-[950px] bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-2 shadow-2xl";

  // ドロップゾーンから現在のカード・壁のノードをクローンして描画
  exportTarget.innerHTML = `
    <div class="text-center pb-2 mb-3 border-b border-gray-800">
      <h2 class="text-xl font-black text-pink-500 tracking-wider">OFFICIAL TIER LIST</h2>
    </div>
    <div class="space-y-2 w-full">
      ${defaultTiers.map(tier => {
        const dropZone = document.getElementById(`drop-${tier.id}`);
        const clonedChildrenHtml = dropZone ? dropZone.innerHTML : '';

        return `
          <div class="flex items-stretch bg-gray-950 border border-gray-800 rounded-lg overflow-hidden min-h-[85px] w-full">
            <!-- ランクヘッダー -->
            <div class="w-20 sm:w-24 flex items-center justify-center font-black text-xl sm:text-2xl border-r border-gray-800 shrink-0 text-center p-2 select-none"
                 style="background-color: ${tier.color}; color:${tier.textColor};">
              ${tier.name}
            </div>

            <!-- ドロップエリア -->
            <div class="flex-1 p-2 flex flex-nowrap items-center gap-2 bg-gray-900/80">
              ${clonedChildrenHtml || '<span class="text-xs text-gray-600 pl-2">なし</span>'}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // 💡 クローン内部（出力対象）のカードだけスタイルを自動書き換え
  exportTarget.querySelectorAll('[id^="card-"]').forEach(card => {
    // 1. カード内のテキストエリア（名前）を非表示
    const textWrapper = card.querySelector('div');
    if (textWrapper) textWrapper.style.display = 'none';

    // 2. 画像をカード全体（100%）に引き伸ばして角丸フィット
    const img = card.querySelector('img');
    if (img) {
      img.style.height = '100%';
      img.style.width = '100%';
      img.style.objectFit = 'cover';
    }

    // 3. 枠線の微調整（必要に応じて）
    card.style.height = '70px'; // モーダル出力時のカード高さを固定
    card.style.width = '56px';  // モーダル出力時のカード幅を固定
  });

  // 不要な削除ボタン等の非表示処理
  exportTarget.querySelectorAll('button').forEach(btn => btn.style.display = 'none');

  const modal = document.getElementById('tier-preview-modal');
  if (modal) modal.classList.remove('hidden');
};

window.closeTierPreviewModal = function() {
  const modal = document.getElementById('tier-preview-modal');
  if (modal) modal.classList.add('hidden');
};

// html2canvasによる高画質PNG画像出力処理
// 8. Tier表 画像ダウンロード処理 (html2canvasのテキスト描画バグ自動補正版)
window.downloadTierImage = async function() {
  const exportTarget = document.getElementById('tier-export-target');
  if (!exportTarget) {
    showToast('保存対象エリアが見つかりません', 'warning');
    return;
  }

  const saveBtn = document.getElementById('save-image-btn');
  const originalText = saveBtn ? saveBtn.innerText : '';
  if (saveBtn) {
    saveBtn.innerText = '⏳ 画像生成中...';
    saveBtn.disabled = true;
  }

  try {
    // 1. 画像の読み込み完了を待機
    const images = Array.from(exportTarget.querySelectorAll('img'));
    await Promise.all(
      images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    // 2. html2canvas の実行 (onclone でテキストの下部見切れを自動補正)
    const canvas = await html2canvas(exportTarget, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#0f172a',
      logging: false,
      onclone: (clonedDoc) => {
        // 画像化用のクローン内にある名前表示用 span 要素だけを取得
        const cardTexts = clonedDoc.querySelectorAll('#tier-export-target span');
        cardTexts.forEach(el => {
          // html2canvas のテキスト上ズレバグを解消するため、キャプチャ時のみ少し下に押し下げる・余白を確保
          el.style.display = 'inline-block';
          el.style.transform = 'translateY(1px)'; // 1px下に補正
          el.style.lineHeight = '1.3';             // 行高に少し余裕を持たせる
        });
      }
    });

    // 3. ダウンロード処理
    const imageUri = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `tier-list_${new Date().toISOString().split('T')[0]}.png`;
    link.href = imageUri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    console.error('画像保存エラー:', err);
    showToast('画像の保存に失敗しました。', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.innerText = originalText;
      saveBtn.disabled = false;
    }
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

// 未配置プール領域クリック時（ランクからタップ移動で未配置に戻す）
/**
 * プール領域（余白）クリック時のハンドラー
 * ランク上の選択中カードを物理削除してプールに復帰させる
 */
window.handlePoolClick = function(e) {
  // カード本体（メンバーカードや壁カード）のタップ時はそれぞれのクリック処理に委ねるため除外
  if (e.target.closest('[id^="card-"]') || e.target.closest('#wall-template')) return;

  if (selectedMemberData && selectedMemberData.id !== 'wall') {
    const rawId = selectedMemberData.id;
    const numId = Number(rawId);
    const strId = String(rawId);

    const hasNumKey = memberPositions.hasOwnProperty(numId);
    const hasStrKey = memberPositions.hasOwnProperty(strId);

    if (hasNumKey || hasStrKey) {
      // 1. データ上の配置位置を削除
      delete memberPositions[numId];
      delete memberPositions[strId];

      // 2. 💡 Tier表（ランク内）に存在するカードのDOM要素を物理的に削除
      const existingTierCards = document.querySelectorAll(
        `#tier-container [id$="${strId}"], #tier-container [data-id="${strId}"]`
      );
      existingTierCards.forEach(el => el.remove());

      // 3. 選択状態を完全に解除
      selectedMemberData = null;

      // 4. 未配置プールを再描画（カードがプールに復活する）
      renderPool();

      // 5. ハイライト枠（ピンク色の枠）を更新
      if (typeof updateCardHighlightStyles === 'function') {
        updateCardHighlightStyles();
      }

      if (typeof showToast === 'function') {
        console.log('選択したメンバーを未配置に戻しました', 'info');
      }
    }
  }
  
};

/**
 * 拠点・グループ・区分のセレクトボックス選択肢を動的生成
 * @param {Array} members - membersテーブルから取得したデータ
 * @param {Array} groups - groupsテーブルから取得したデータ
 */
function setupTierFilters(members, groups = []) {
  allGroups = groups;

  const branchSelect = document.getElementById('tier-branch-filter');
  const categorySelect = document.getElementById('tier-category-filter');

  // 1. 拠点の抽出 (groups.prefecture ＋ members.prefecture)
  if (branchSelect) {
    const branches = new Set();
    groups.forEach(g => { if (g.prefecture) branches.add(g.prefecture); });
    members.forEach(m => { if (m.prefecture) branches.add(m.prefecture); });

    branchSelect.innerHTML = '<option value="">🌐 すべての拠点</option>';
    Array.from(branches).sort().forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      branchSelect.appendChild(opt);
    });
  }

  // 2. グループセレクトボックスの初期化（「無所属」を含む）
  updateGroupOptions();

  // 3. 区分の抽出 (members.category ＋ groups.category)
  if (categorySelect) {
    const categories = new Set();
    members.forEach(m => { if (m.category) categories.add(m.category); });
    groups.forEach(g => { if (g.category) categories.add(g.category); });

    categorySelect.innerHTML = '<option value="">🏷️ すべての区分</option>';
    Array.from(categories).sort().forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      categorySelect.appendChild(opt);
    });
  }
}

/**
 * 拠点選択の変更イベントハンドラー
 */
window.handleBranchChange = function() {
  updateGroupOptions();
  filterPoolMembers();
};

/**
 * 選択された拠点に応じてグループ選択肢を絞り込み（無所属を含む）
 */
function updateGroupOptions() {
  const selectedBranch = document.getElementById('tier-branch-filter')?.value || '';
  const groupSelect = document.getElementById('tier-group-filter');
  if (!groupSelect) return;

  groupSelect.innerHTML = '<option value="">🏢 すべてのグループ</option>';

  // 常時「無所属」の選択肢を追加
  const unassignedOpt = document.createElement('option');
  unassignedOpt.value = 'unassigned';
  unassignedOpt.textContent = '❓ 無所属';
  groupSelect.appendChild(unassignedOpt);

  // 拠点に基づくグループの抽出
  let filteredGroups = allGroups;
  if (selectedBranch) {
    filteredGroups = allGroups.filter(g => g.prefecture === selectedBranch);
  }

  filteredGroups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = String(g.id);       // IDを数値文字列として保持
    opt.textContent = g.name || ''; // 表示はグループ名
    groupSelect.appendChild(opt);
  });
}

/**
 * 1. 現在のTier表の状態を共通フォーマット(JSONオブジェクト)で取得
 */
function getCurrentTierState(title = '') {
  const currentTitle = title || document.getElementById('tier-title-input')?.value || '無題のTier表';
  
  return {
    title: currentTitle,
    updated_at: new Date().toISOString(),
    tier_data: {
      tiers: Array.isArray(defaultTiers) ? defaultTiers : [],
      positions: memberPositions || {},
      wall_count: wallCount || 0
    }
  };
}

/**
 * 2. 渡されたデータオブジェクトを画面(グローバル変数 & DOM)に反映・復元
 */
function loadTierState(stateData) {
  if (!stateData || !stateData.tier_data) return;

  const { tiers, positions, wall_count } = stateData.tier_data;

  // タイトルの反映
  const titleInput = document.getElementById('tier-title-input');
  if (titleInput && stateData.title) {
    titleInput.value = stateData.title;
  }

  // 1. ランク構成の復元
  if (Array.isArray(tiers)) {
    defaultTiers = JSON.parse(JSON.stringify(tiers));
  }

  // 2. 配置情報の復元
  if (positions && typeof positions === 'object') {
    memberPositions = JSON.parse(JSON.stringify(positions));
  }

  // 3. 壁カウンターの復元
  if (typeof wall_count === 'number') {
    wallCount = wall_count;
  }

  // 選択状態のリセット
  selectedMemberData = null;

  // 画面の再描画
  if (typeof renderTierBoard === 'function') renderTierBoard();
  if (typeof restoreCardPositions === 'function') restoreCardPositions();
  if (typeof renderPool === 'function') renderPool();
  if (typeof updateCardHighlightStyles === 'function') updateCardHighlightStyles();
}

/**
 * 3. LocalStorageへのドラフト自動保存 (オートセーブ)
 */
function saveDraftToLocalStorage() {
  // 短時間に何度も連続で呼ばれた場合（ループ描画時など）に何十回も保存が走るのを防ぐ
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(() => {
    try {
      const state = getCurrentTierState();
      localStorage.setItem('tier_board_draft', JSON.stringify(state));
    } catch (e) {
      console.error('Draft auto-save failed:', e);
    }
  }, 300); // 0.3秒間操作が落ち着いたら1回だけ保存
}

/**
 * 4. LocalStorageからのドラフト自動読み込み
 */
function loadDraftFromLocalStorage() {
  try {
    const saved = localStorage.getItem('tier_board_draft');
    if (saved) {
      const state = JSON.parse(saved);
      loadTierState(state);
      if (typeof showToast === 'function') {
        showToast('前回の編集状態を復元しました', 'info');
      }
    }
  } catch (e) {
    console.error('Draft auto-load failed:', e);
  }
}

/**
 * 5. ドラフトの一時保存クリア (新規作成時などに使用)
 */
function clearDraftLocalStorage() {
  localStorage.removeItem('tier_board_draft');
}

/**
 * Tier表のリセット確認と実行
 */
window.confirmResetTierBoard = async function() {
  const isConfirmed = await showConfirmModal({
    title: 'Tier表のリセット',
    message: '配置されたメンバーやランク設定をすべてリセットしますか？\n※この操作は取り消せません。',
    confirmText: 'リセットする',
    cancelText: 'キャンセル',
    type: 'danger'
  });
  
  if (isConfirmed) {
    resetTierBoard();
  }
};

/**
 * Tier表を初期状態に戻す処理
 */
function resetTierBoard() {
  // 1. LocalStorageのドラフトを消去
  clearDraftLocalStorage();

  // 2. 配置データと壁カウンターをリセット
  memberPositions = {};
  wallCount = 0;
  selectedMemberData = null;

  // 3. ランク構成（defaultTiers）をデフォルト状態に戻す（必要に応じて）
  // ※もしデフォルトのランクセット（S, A, B, C等）が定義してあれば再代入
  /*
  defaultTiers = [
    { id: 'tier-S', name: 'S', color: '#ff7f7f', textColor: '#000000' },
    { id: 'tier-A', name: 'A', color: '#ffbf7f', textColor: '#000000' },
    { id: 'tier-B', name: 'B', color: '#ffff7f', textColor: '#000000' },
    { id: 'tier-C', name: 'C', color: '#7fff7f', textColor: '#000000' }
  ];
  */

  // 4. タイトル入力欄のリセット
  const titleInput = document.getElementById('tier-title-input');
  if (titleInput) {
    titleInput.value = '無題のTier表';
  }

  // 5. 画面の再描画
  if (typeof renderTierBoard === 'function') renderTierBoard();
  if (typeof restoreCardPositions === 'function') restoreCardPositions();
  if (typeof renderPool === 'function') renderPool();
  if (typeof updateCardHighlightStyles === 'function') updateCardHighlightStyles();

  if (typeof showToast === 'function') {
    showToast('Tier表を初期状態にリセットしました', 'info');
  }
}

/**
 * UI状態（フィルター・ソート・アコーディオン開閉）をLocalStorageに保存
 */
function saveUIPreferences() {
  // 💡 初期化処理が終わるまでは保存処理を走らせない（上書き防止）
  if (!isTierUIInitialized) return;

  try {
    const prefs = {
      branch: document.getElementById('tier-branch-filter')?.value || '',
      group: document.getElementById('tier-group-filter')?.value || '',
      category: document.getElementById('tier-category-filter')?.value || '',
      sortKey: typeof currentSortKey !== 'undefined' ? currentSortKey : 'ruby',
      isSortAsc: typeof isSortAsc !== 'undefined' ? isSortAsc : true,
      isAccordionOpen: !document.getElementById('filter-accordion-content')?.classList.contains('hidden')
    };
    localStorage.setItem('tier_ui_preferences', JSON.stringify(prefs));
  } catch (e) {
    console.error('UI preferences save failed:', e);
  }
}

/**
 * LocalStorageからUI状態を読み込んで画面に適用
 */
function loadUIPreferences() {
  try {
    const saved = localStorage.getItem('tier_ui_preferences');
    if (!saved) return;

    const prefs = JSON.parse(saved);

    // 1. 拠点フィルターの復元
    const branchEl = document.getElementById('tier-branch-filter');
    if (branchEl && prefs.branch !== undefined) {
      branchEl.value = prefs.branch;
      if (typeof updateGroupOptions === 'function') updateGroupOptions();
    }

    // 2. グループ・区分フィルターの復元
    const groupEl = document.getElementById('tier-group-filter');
    if (groupEl && prefs.group !== undefined) groupEl.value = prefs.group;

    const categoryEl = document.getElementById('tier-category-filter');
    if (categoryEl && prefs.category !== undefined) categoryEl.value = prefs.category;

    // 3. 💡 ソートキーおよび昇順・降順の復元
    if (prefs.sortKey !== undefined) currentSortKey = prefs.sortKey;
    if (prefs.isSortAsc !== undefined) isSortAsc = prefs.isSortAsc;

    // 4. アコーディオン開閉状態の復元
    const content = document.getElementById('filter-accordion-content');
    const arrow = document.getElementById('accordion-arrow');
    const btn = document.getElementById('toggle-filter-btn');

    if (content && prefs.isAccordionOpen) {
      content.classList.remove('hidden');
      if (arrow) arrow.textContent = '▲';
      if (btn) btn.classList.add('border-pink-500/50');
    }

    // 5. 💡 ソートボタンのUI表示（ピンク枠や矢印）を同期
    if (typeof updateSortUI === 'function') updateSortUI();

    // 6. 💡 復元されたソート順・フィルター条件でプール画面を最終再描画
    if (typeof renderPool === 'function') renderPool();

  } catch (e) {
    console.error('UI preferences load failed:', e);
  }
}

/**
 * ユーザーの保存済みTier表一覧を取得する
 */
async function fetchUserTierLists() {
  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('tier_lists')
    .select('id, title, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Tier表一覧の取得に失敗:', error);
    return [];
  }
  return data || [];
}

/**
 * Tier表の保存処理（20件上限チェック付き）
 * @param {string} title 
 * @param {Object} tierData 
 * @param {string|null} currentListId 新規ならnull、上書きならUUID
 */
async function saveTierList(title, tierData, currentListId = null) {
  const user = await getCurrentUser();
  if (!user) {
    if (typeof showConfirmModal === 'function') {
      await showConfirmModal({
        title: '🔒 ログインが必要です',
        message: '保存機能を利用するにはログインが必要です。',
        confirmText: 'OK',
        showCancel: false,
        type: 'info'
      });
    }
    return { success: false, reason: 'unauthorized' };
  }

  // 新規保存の場合は20件の上限チェック
  if (!currentListId) {
    const existingLists = await fetchUserTierLists();
    if (existingLists.length >= 20) {
      if (typeof showConfirmModal === 'function') {
        await showConfirmModal({
          title: '⚠️ 保存上限エラー',
          message: '保存件数が上限（20件）に達しています。\n不要なリストを削除するか、既存のリストに上書き保存してください。',
          confirmText: '了解',
          showCancel: false,
          type: 'warning'
        });
      }
      return { success: false, reason: 'limit_exceeded' };
    }
  }

  // 💡 data を tier_data に修正！
  const payload = {
    user_id: user.id,
    title: title,
    tier_data: tierData,
    updated_at: new Date().toISOString()
  };

  let response;
  if (currentListId) {
    // 上書き保存
    response = await supabase
      .from('tier_lists')
      .update(payload)
      .eq('id', currentListId)
      .select();
  } else {
    // 新規保存
    response = await supabase
      .from('tier_lists')
      .insert(payload)
      .select();
  }

  if (response.error) {
    console.error('保存失敗:', response.error);
    if (typeof showConfirmModal === 'function') {
      await showConfirmModal({
        title: '❌ 保存エラー',
        message: `保存に失敗しました:\n${response.error.message}`,
        confirmText: '閉じる',
        showCancel: false,
        type: 'danger'
      });
    }
    return { success: false, message: response.error.message };
  }

  // 保存成功通知
  if (typeof showConfirmModal === 'function') {
    await showConfirmModal({
      title: '🎉 保存完了',
      message: `Tier表「${title}」を保存しました！`,
      confirmText: 'OK',
      showCancel: false,
      type: 'info'
    });
  }

  return { success: true, data: response.data[0] };
}

/**
 * ID指定でTier表データを1件読み込む
 */
async function loadTierListById(id) {
  const { data, error } = await supabase
    .from('tier_lists')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('データの取得に失敗:', error);
    return null;
  }
  return data;
}

/**
 * Tier表の削除処理
 */
async function deleteTierList(id) {
  const { error } = await supabase
    .from('tier_lists')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('削除失敗:', error);
    return false;
  }
  return true;
}

/**
 * 【保存モーダルを開く】
 */
async function openSaveModal() {
  const user = await getCurrentUser();
  if (!user) {
    if (typeof showConfirmModal === 'function') {
      await showConfirmModal({
        title: '🔒 ログインが必要です',
        message: '保存機能を利用するにはログインが必要です。',
        confirmText: 'OK',
        showCancel: false,
        type: 'info'
      });
    }
    return;
  }

  // 現在の保存件数を取得して上限警告を表示
  const existingLists = await fetchUserTierLists();
  const warningEl = document.getElementById('save-limit-warning');
  
  if (!currentEditingTierId && existingLists.length >= 20) {
    warningEl.classList.remove('hidden');
  } else {
    warningEl.classList.add('hidden');
  }

  document.getElementById('save-modal').classList.remove('hidden');
}

/**
 * 【保存モーダルを閉じる】
 */
function closeSaveModal() {
  document.getElementById('save-modal').classList.add('hidden');
  document.getElementById('save-title-input').value = '';
}

/**
 * 【保存実行処理（モーダルの「保存する」ボタン）】
 */
async function handleExecSave() {
  const titleInput = document.getElementById('save-title-input').value.trim();
  if (!titleInput) {
    if (typeof showConfirmModal === 'function') {
      await showConfirmModal({
        title: '⚠️ 入力エラー',
        message: 'タイトルを入力してください。',
        confirmText: 'OK',
        showCancel: false,
        type: 'warning'
      });
    }
    return;
  }

  // 💡 既存の getCurrentTierState() を使用して現在の状態を取得！
  const tierData = getCurrentTierState();

  const result = await saveTierList(titleInput, tierData, currentEditingTierId);

  if (result.success) {
    currentEditingTierId = result.data.id;
    closeSaveModal();
  }
}

/**
 * 【読み込みモーダルを開く】
 */
async function openLoadModal() {
  const user = await getCurrentUser();
  if (!user) {
    if (typeof showConfirmModal === 'function') {
      await showConfirmModal({
        title: '🔒 ログインが必要です',
        message: '一覧を読み込むにはログインが必要です。',
        confirmText: 'OK',
        showCancel: false,
        type: 'info'
      });
    }
    return;
  }

  await renderSavedTierList();
  document.getElementById('load-modal').classList.remove('hidden');
}

/**
 * 【読み込みモーダルを閉じる】
 */
function closeLoadModal() {
  document.getElementById('load-modal').classList.add('hidden');
}

/**
 * モーダル内に保存済み一覧を描画する
 */
async function renderSavedTierList() {
  const container = document.getElementById('saved-list-container');
  const countBadge = document.getElementById('saved-count-badge');
  container.innerHTML = '<div class="text-center py-4 text-xs text-gray-400">読み込み中...</div>';

  const lists = await fetchUserTierLists();
  countBadge.textContent = `${lists.length}/20`;

  if (lists.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-xs text-gray-500">保存されたTier表はありません</div>';
    return;
  }

  container.innerHTML = lists.map(item => {
    const dateStr = new Date(item.updated_at).toLocaleString('ja-JP', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });

    return `
      <div class="flex items-center justify-between p-3 bg-gray-900/60 hover:bg-gray-900 border border-gray-700/50 rounded-xl transition">
        <div class="space-y-0.5 cursor-pointer flex-1" onclick="handleSelectTier('${item.id}')">
          <div class="text-sm font-bold text-white hover:text-pink-400 transition">${item.title}</div>
          <div class="text-[10px] text-gray-500 font-mono">最終更新: ${dateStr}</div>
        </div>
        <div class="flex items-center gap-2 pl-3">
          <button onclick="handleSelectTier('${item.id}')" class="px-2.5 py-1 bg-pink-600/80 hover:bg-pink-600 text-white text-xs rounded-lg transition">
            開く
          </button>
          <button onclick="handleDeleteTier('${item.id}', '${item.title}')" class="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs rounded-lg transition">
            削除
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 一覧からデータを選択して画面に復元する
 */
async function handleSelectTier(id) {
  const item = await loadTierListById(id);
  if (!item) return;

  currentEditingTierId = item.id;
  
  // 💡 item.data から item.tier_data に修正！
  if (typeof loadTierState === 'function') {
    loadTierState(item.tier_data);
  }

  closeLoadModal();

  if (typeof showConfirmModal === 'function') {
    await showConfirmModal({
      title: '📂 読み込み完了',
      message: `「${item.title}」を読み込みました。`,
      confirmText: 'OK',
      showCancel: false,
      type: 'info'
    });
  }
}

/**
 * 一覧から削除を実行する
 */
async function handleDeleteTier(id, title) {
  const success = await deleteTierList(id, title);
  if (success) {
    if (currentEditingTierId === id) {
      currentEditingTierId = null; // 編集中のものが消されたらIDクリア
    }
    await renderSavedTierList(); // リスト再描画
  }
}

/**
 * ハンバーガーメニューの開閉
 */
function toggleTierMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('tier-dropdown-menu');
  menu.classList.toggle('hidden');
}

/**
 * メニュー外をクリックしたときに自動で閉じる
 */
document.addEventListener('click', (e) => {
  const menu = document.getElementById('tier-dropdown-menu');
  const btn = document.getElementById('tier-menu-toggle-btn');
  if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !btn?.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

/**
 * ドロップダウンメニューの各アクション実行
 */
function execMenuAction(actionType) {
  // メニューを閉じる
  document.getElementById('tier-dropdown-menu')?.classList.add('hidden');

  switch (actionType) {
    case 'addRank':
      if (typeof addTierRow === 'function') addTierRow();
      break;
    case 'openLoad':
      if (typeof openLoadModal === 'function') openLoadModal();
      break;
    case 'openPreview':
      if (typeof openTierPreviewModal === 'function') openTierPreviewModal();
      break;
    case 'resetTier':
      if (typeof confirmResetTierBoard === 'function') confirmResetTierBoard();
      break;
  }
}
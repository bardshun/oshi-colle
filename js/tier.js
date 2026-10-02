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

document.addEventListener('DOMContentLoaded', async () => {
  renderTierBoard();
  await loadTierMembers();
  loadGroupsFilter();
});

// 1. Tierボードのレンダリング
function renderTierBoard() {
  const container = document.getElementById('tier-container');
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
      <div id="drop-${tier.id}" ondrop="dropToTier(event, '${tier.id}')" ondragover="allowDrop(event)" 
           class="tier-content flex-1 p-2 flex flex-wrap gap-2 items-center bg-gray-900/60 min-h-[90px]">
      </div>
    </div>
  `).join('');
}

// 2. Supabaseからメンバー＆画像取得
async function loadTierMembers() {
  const { data, error } = await supabase
    .from('members')
    .select(`*, groups(name), member_images(image_url, is_default)`)
    .order('name');

  if (error) {
    console.error('メンバー取得失敗:', error);
    return;
  }

  allMembers = data || [];
  renderPool();
}

// 3. グループフィルターの初期化
async function loadGroupsFilter() {
  const { data } = await supabase.from('groups').select('*').order('name');
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
  const filterGroup = document.getElementById('tier-group-filter')?.value;

  const unplaced = allMembers.filter(m => {
    const isPlaced = !!memberPositions[m.id];
    const matchGroup = !filterGroup || String(m.group_id) === filterGroup;
    return !isPlaced && matchGroup;
  });

  document.getElementById('pool-count').innerText = `${unplaced.length}名`;

  // 1番目に常時「無限の壁カード」を置く
  const wallCardHtml = `
    <div id="wall-template" draggable="true" ondragstart="dragStart(event, 'wall')" 
         class="w-16 h-20 sm:w-20 sm:h-24 bg-black text-white border-2 border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-grab active:cursor-grabbing hover:border-white transition flex-shrink-0 select-none shadow">
      <span class="text-xl sm:text-2xl font-black">壁</span>
      <span class="text-[9px] text-gray-400 mt-1">無限追加</span>
    </div>
  `;

  const memberCardsHtml = unplaced.map(m => createMemberCardHtml(m)).join('');
  poolEl.innerHTML = wallCardHtml + memberCardsHtml;
}

// メンバーカードHTML生成
function createMemberCardHtml(m) {
  const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
  const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/100?text=No+Img';

  return `
    <div id="card-${m.id}" draggable="true" ondragstart="dragStart(event, '${m.id}')" 
         class="w-16 h-20 sm:w-20 sm:h-24 bg-gray-800 rounded-lg overflow-hidden border border-gray-700 cursor-grab active:cursor-grabbing hover:border-pink-500 flex flex-col flex-shrink-0 select-none shadow">
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

function dropToTier(e, tierId) {
  e.preventDefault();
  const data = e.dataTransfer.getData('text/plain');
  if (!data) return;

  const targetDropZone = document.getElementById(`drop-${tierId}`);
  if (!targetDropZone) return;

  // 「壁」がドロップされた場合 ➔ 新しい壁エレメントを生成して配置
  if (data === 'wall') {
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
    targetDropZone.appendChild(newWallEl);
    return;
  }

  // 配置済みの壁を別のランクへ移動する場合
  if (data.startsWith('wall-placed-')) {
    const wallEl = document.getElementById(data);
    if (wallEl) targetDropZone.appendChild(wallEl);
    return;
  }

  // 通常のメンバーカードを配置する場合
  memberPositions[data] = tierId;
  const cardEl = document.getElementById(`card-${data}`);
  if (cardEl) {
    targetDropZone.appendChild(cardEl);
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

function restoreCardPositions() {
  Object.keys(memberPositions).forEach(mId => {
    const tierId = memberPositions[mId];
    const cardEl = document.getElementById(`card-${mId}`);
    const dropZone = document.getElementById(`drop-${tierId}`);
    if (cardEl && dropZone) dropZone.appendChild(cardEl);
  });
}

function filterPoolMembers() {
  renderPool();
}

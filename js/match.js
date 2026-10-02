let membersList = [];
let currentIndex = 0;
let userNames = { A: '', B: '', C: '' };
let currentLikes = { A: false, B: false, C: false };
let matchResults = []; // [{ member: {}, likes: {A:bool, B:bool, C:bool} }]

// 1. ゲーム初期化（ランダムにシャッフル）
async function startGame() {
  userNames.A = document.getElementById('user-a-name').value || 'Aさん';
  userNames.B = document.getElementById('user-b-name').value || 'Bさん';
  userNames.C = document.getElementById('user-c-name').value || 'Cさん';

  // ボタンラベル更新
  document.getElementById('label-user-a').innerText = userNames.A;
  document.getElementById('label-user-b').innerText = userNames.B;
  document.getElementById('label-user-c').innerText = userNames.C;

  // Supabaseからメンバー取得
  const { data, error } = await supabase
    .from('members')
    .select(`*, groups(name), member_images(image_url, is_default)`);

  if (error || !data || data.length === 0) {
    alert('メンバーが登録されていません。まずは管理画面でメンバーを登録してください！');
    return;
  }

  // ランダムシャッフル
  membersList = data.sort(() => Math.random() - 0.5);
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

  // 選択フラグリセット
  currentLikes = { A: false, B: false, C: false };
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
    const isLiked = currentLikes[u];
    
    if (isLiked) {
      btn.className = btn.className.replace('bg-gray-900/80', 'bg-pink-600 text-white border-pink-400');
      btn.querySelector('span:first-child').innerText = '💖';
    } else {
      btn.className = "p-3 rounded-xl border-2 border-gray-700 bg-gray-900/80 hover:bg-gray-800 transition flex flex-col items-center justify-center space-y-1";
      btn.querySelector('span:first-child').innerText = '🤍';
    }
  });
}

// 4. 次のメンバーへ
function nextMember() {
  // 結果を保存
  matchResults.push({
    member: membersList[currentIndex],
    likes: { ...currentLikes }
  });

  // 全員一致の数をカウント
  const allMatchCount = matchResults.filter(r => r.likes.A && r.likes.B && r.likes.C).length;
  document.getElementById('match-count-badge').innerText = `共通点: ${allMatchCount}名`;

  currentIndex++;
  showCurrentMember();
}

// 5. 結果画面のレンダリング
function showResults() {
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('result-screen').classList.remove('hidden');

  const allMatchEl = document.getElementById('result-all-match');
  const twoMatchEl = document.getElementById('result-two-match');

  // ① 3人全員が「好き」のメンバー
  const allMatches = matchResults.filter(r => r.likes.A && r.likes.B && r.likes.C);
  
  if (allMatches.length === 0) {
    allMatchEl.innerHTML = '<div class="col-span-full text-center py-4 text-xs text-gray-500">3人全員が一致したメンバーはありませんでした 😅</div>';
  } else {
    allMatchEl.innerHTML = allMatches.map(r => createResultCardHtml(r.member)).join('');
  }

  // ② 2人だけ「好き」のメンバー
  const abMatches = matchResults.filter(r => r.likes.A && r.likes.B && !r.likes.C);
  const bcMatches = matchResults.filter(r => !r.likes.A && r.likes.B && r.likes.C);
  const acMatches = matchResults.filter(r => r.likes.A && !r.likes.B && r.likes.C);

  let twoHtml = '';
  if (abMatches.length) twoHtml += renderTwoGroup(`${userNames.A} ＆ ${userNames.B}`, abMatches);
  if (bcMatches.length) twoHtml += renderTwoGroup(`${userNames.B} ＆ ${userNames.C}`, bcMatches);
  if (acMatches.length) twoHtml += renderTwoGroup(`${userNames.A} ＆ ${userNames.C}`, acMatches);

  twoMatchEl.innerHTML = twoHtml || '<div class="text-center py-2 text-gray-500">2人の共通点もありませんでした</div>';
}

function createResultCardHtml(m) {
  const defaultImg = m.member_images?.find(i => i.is_default) || m.member_images?.[0];
  const imgUrl = defaultImg ? defaultImg.image_url : 'https://via.placeholder.com/150';

  return `
    <div class="bg-gray-900 rounded-xl overflow-hidden border border-yellow-500/50 p-1 text-center">
      <img src="${imgUrl}" class="w-full aspect-square object-cover rounded-lg mb-1">
      <div class="font-bold text-[11px] truncate">${m.name}</div>
      <div class="text-[9px] text-pink-400 truncate">${m.groups ? m.groups.name : ''}</div>
    </div>
  `;
}

function renderTwoGroup(title, list) {
  const cards = list.map(r => createResultCardHtml(r.member)).join('');
  return `
    <div class="bg-gray-900/60 p-3 rounded-xl border border-gray-700/60 space-y-2">
      <div class="font-bold text-pink-400">${title} の好きな顔</div>
      <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">${cards}</div>
    </div>
  `;
}

function resetGame() {
  document.getElementById('result-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('setup-screen').classList.remove('hidden');
}

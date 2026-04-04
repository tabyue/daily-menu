/**
 * 每日家庭食谱 - 核心 JS
 * 负责：日期切换、数据加载、菜谱渲染、做法弹窗、历史回看、换菜
 */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const DAY_LABELS = ['今天', '明天', '后天'];

  function getSeason(month) {
    if (month >= 3 && month <= 5) return { name: '春季时令', emoji: '🌸' };
    if (month >= 6 && month <= 8) return { name: '夏季时令', emoji: '☀️' };
    if (month >= 9 && month <= 11) return { name: '秋季时令', emoji: '🍂' };
    return { name: '冬季时令', emoji: '❄️' };
  }

  // ===== 状态 =====
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let currentDate = formatDate(today);
  let menuCache = {};
  let swapState = {}; // key: "date|meal|idx" → altIndex (0=原菜)

  // ===== 初始化 =====
  function init() {
    const season = getSeason(today.getMonth() + 1);
    $('#seasonTag').textContent = season.emoji + ' ' + season.name;
    const header = $('.header');
    if (header) {
      document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
    }
    loadSwapState();
    renderDateTabs();
    bindEvents();
    loadMenu(currentDate);
  }

  // ===== 换菜状态持久化 =====
  function loadSwapState() {
    try {
      const s = localStorage.getItem('menu_swap');
      if (s) swapState = JSON.parse(s);
    } catch (e) {}
  }
  function saveSwapState() {
    try { localStorage.setItem('menu_swap', JSON.stringify(swapState)); } catch (e) {}
  }

  function getDish(dateStr, mealKey, idx, dish) {
    const key = `${dateStr}|${mealKey}|${idx}`;
    const ai = swapState[key] || 0;
    if (ai === 0 || !dish.alternatives || !dish.alternatives[ai - 1]) return dish;
    return { ...dish.alternatives[ai - 1], alternatives: dish.alternatives };
  }

  // ===== 日期标签 =====
  function renderDateTabs() {
    const container = $('#dateTabs');
    container.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = formatDate(d);
      const tab = document.createElement('div');
      tab.className = 'date-tab' + (dateStr === currentDate ? ' active' : '') + (i === 0 ? ' today' : '');
      tab.dataset.date = dateStr;
      tab.innerHTML = `
        <span class="day-name">${DAY_LABELS[i]}</span>
        <span class="day-date">${(d.getMonth() + 1)}/${d.getDate()} ${WEEKDAYS[d.getDay()]}</span>
      `;
      tab.addEventListener('click', () => selectDate(dateStr));
      container.appendChild(tab);
    }
  }

  function selectDate(dateStr) {
    currentDate = dateStr;
    document.querySelectorAll('.date-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.date === dateStr);
    });
    loadMenu(dateStr);
  }

  // ===== 数据加载 =====
  async function loadMenu(dateStr) {
    $('#loading').style.display = 'flex';
    $('#emptyState').style.display = 'none';
    $('#mealsContainer').style.display = 'none';

    if (menuCache[dateStr]) { renderMenu(menuCache[dateStr]); return; }

    try {
      const resp = await fetch(`data/${dateStr}.json`);
      if (!resp.ok) throw new Error('No data');
      const data = await resp.json();
      menuCache[dateStr] = data;
      renderMenu(data);
    } catch (e) {
      $('#loading').style.display = 'none';
      $('#emptyState').style.display = 'block';
    }
  }

  // ===== 渲染 =====
  function renderMenu(data) {
    $('#loading').style.display = 'none';
    $('#emptyState').style.display = 'none';
    $('#mealsContainer').style.display = 'block';

    if (data.summary) {
      $('#dailySummary').innerHTML = `
        <div class="summary-title">📋 ${data.date || currentDate} 膳食计划</div>
        <div>${data.summary}</div>
        ${data.tags ? `<div class="summary-tags">${data.tags.map(t => `<span class="summary-tag">${t}</span>`).join('')}</div>` : ''}
      `;
      $('#dailySummary').style.display = 'block';
    } else {
      $('#dailySummary').style.display = 'none';
    }

    renderMealSection('breakfastBody', 'breakfast', data.breakfast);
    renderMealSection('lunchBody', 'lunch', data.lunch);
    renderMealSection('dinnerBody', 'dinner', data.dinner);
    renderMealSection('fruitBody', 'fruit', data.fruit);
    renderMealSection('snackBody', 'snack', data.snack);

    if (data.tips) {
      $('#tipsBody').innerHTML = data.tips.map(t => `<p>• ${t}</p>`).join('');
      $('#tipsCard').style.display = 'block';
    } else {
      $('#tipsCard').style.display = 'none';
    }

    document.querySelectorAll('#mealsContainer .meal-card').forEach((card, i) => {
      card.style.animation = 'none';
      card.offsetHeight;
      card.style.animation = `fadeInUp 0.4s ease ${i * 0.05}s both`;
    });
  }

  function renderMealSection(containerId, mealKey, dishes) {
    const container = $(`#${containerId}`);
    if (!dishes || dishes.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;">暂无数据</p>';
      return;
    }

    container.innerHTML = dishes.map((dish, idx) => {
      const cur = getDish(currentDate, mealKey, idx, dish);
      const hasAlts = dish.alternatives && dish.alternatives.length > 0;
      const key = `${currentDate}|${mealKey}|${idx}`;
      const isSwapped = (swapState[key] || 0) > 0;

      return `
      <div class="dish-item" id="dish-${mealKey}-${idx}">
        <div class="dish-emoji">${cur.emoji || '🍽️'}</div>
        <div class="dish-info">
          <div class="dish-name">
            ${cur.name}
            ${(cur.tags || []).map(t => `<span class="dish-tag ${t.type}">${t.label}</span>`).join('')}
            ${isSwapped ? '<span class="dish-tag swapped">已换</span>' : ''}
          </div>
          ${cur.desc ? `<div class="dish-desc">${cur.desc}</div>` : ''}
          ${cur.amount ? `<div class="dish-amount">👨‍👦 ${cur.amount}</div>` : ''}
        </div>
        <div class="dish-actions">
          ${hasAlts ? `<button class="dish-swap-btn" data-meal="${mealKey}" data-idx="${idx}">换</button>` : ''}
          ${cur.recipe ? `<button class="dish-recipe-btn" data-meal="${containerId}" data-idx="${idx}">做法</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  // ===== 换菜 =====
  function swapDish(mealKey, idx) {
    const data = menuCache[currentDate];
    if (!data) return;
    const dishes = data[mealKey];
    if (!dishes || !dishes[idx]) return;
    const dish = dishes[idx];
    if (!dish.alternatives || dish.alternatives.length === 0) return;

    const key = `${currentDate}|${mealKey}|${idx}`;
    const cur = swapState[key] || 0;
    swapState[key] = (cur + 1) % (dish.alternatives.length + 1);
    saveSwapState();

    const containerMap = { breakfast:'breakfastBody', lunch:'lunchBody', dinner:'dinnerBody', fruit:'fruitBody', snack:'snackBody' };
    renderMealSection(containerMap[mealKey], mealKey, dishes);

    const el = $(`#dish-${mealKey}-${idx}`);
    if (el) { el.classList.add('dish-swap-anim'); setTimeout(() => el.classList.remove('dish-swap-anim'), 500); }
  }

  // ===== 做法弹窗 =====
  function showRecipe(containerId, idx) {
    const keyMap = { breakfastBody:'breakfast', lunchBody:'lunch', dinnerBody:'dinner', fruitBody:'fruit', snackBody:'snack' };
    const mealKey = keyMap[containerId];
    const data = menuCache[currentDate];
    if (!data) return;
    const dishes = data[mealKey];
    if (!dishes || !dishes[idx]) return;

    const cur = getDish(currentDate, mealKey, idx, dishes[idx]);
    if (!cur.recipe) return;

    $('#recipeTitle').textContent = `📝 ${cur.name} - 做法`;
    $('#recipeBody').innerHTML = `
      ${cur.recipe.ingredients ? `<div class="recipe-section"><h4>🥬 食材准备</h4><ul>${cur.recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul></div>` : ''}
      ${cur.recipe.steps ? `<div class="recipe-section"><h4>👩‍🍳 烹饪步骤</h4><ul class="recipe-steps">${cur.recipe.steps.map(s => `<li>${s}</li>`).join('')}</ul></div>` : ''}
      ${cur.recipe.tips ? `<div class="recipe-section"><h4>💡 小窍门</h4><ul>${cur.recipe.tips.map(t => `<li>${t}</li>`).join('')}</ul></div>` : ''}
    `;
    $('#recipeModal').classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeRecipeModal() { $('#recipeModal').classList.remove('show'); document.body.style.overflow = ''; }

  // ===== 历史 =====
  function openHistory() { $('#historyDate').value = currentDate; $('#historyOverlay').classList.add('show'); document.body.style.overflow = 'hidden'; }
  function closeHistory() { $('#historyOverlay').classList.remove('show'); document.body.style.overflow = ''; }
  function goHistory() {
    const val = $('#historyDate').value;
    if (!val) return;
    closeHistory();
    document.querySelectorAll('.date-tab').forEach(t => t.classList.remove('active'));
    currentDate = val;
    loadMenu(val);
  }

  // ===== 事件 =====
  function bindEvents() {
    $('#mealsContainer').addEventListener('click', (e) => {
      const swap = e.target.closest('.dish-swap-btn');
      if (swap) { swapDish(swap.dataset.meal, parseInt(swap.dataset.idx)); return; }
      const recipe = e.target.closest('.dish-recipe-btn');
      if (recipe) { showRecipe(recipe.dataset.meal, parseInt(recipe.dataset.idx)); }
    });
    $('#closeRecipe').addEventListener('click', closeRecipeModal);
    $('#recipeModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeRecipeModal(); });
    $('#historyBtn').addEventListener('click', openHistory);
    $('#closeHistory').addEventListener('click', closeHistory);
    $('#historyGo').addEventListener('click', goHistory);
    $('#historyOverlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeHistory(); });
    $('#backToday').addEventListener('click', () => { currentDate = formatDate(today); renderDateTabs(); loadMenu(currentDate); });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();

/**
 * 每日家庭食谱 - 核心 JS
 * 负责：日期切换、数据加载、菜谱渲染、做法弹窗、历史回看、换一个
 */

(function () {
  'use strict';

  // ===== 工具函数 =====
  const $ = (sel) => document.querySelector(sel);
  const formatDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const DAY_LABELS = ['今天', '明天', '后天', '第4天', '第5天'];

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

  // 记录每道菜当前使用的是哪个备选（主菜=0, 备选1=1, 备选2=2...）
  // key: "dateStr|mealKey|idx"  value: alternativeIndex
  let swapState = {};

  // ===== 初始化 =====
  function init() {
    const season = getSeason(today.getMonth() + 1);
    $('#seasonTag').textContent = season.emoji + ' ' + season.name;
    loadSwapState();
    renderDateTabs();
    bindEvents();
    loadMenu(currentDate);
  }

  // ===== 换菜状态持久化（localStorage）=====
  function loadSwapState() {
    try {
      const saved = localStorage.getItem('dailyMenu_swapState');
      if (saved) swapState = JSON.parse(saved);
    } catch (e) { /* ignore */ }
  }

  function saveSwapState() {
    try {
      localStorage.setItem('dailyMenu_swapState', JSON.stringify(swapState));
    } catch (e) { /* ignore */ }
  }

  function getSwapKey(dateStr, mealKey, idx) {
    return `${dateStr}|${mealKey}|${idx}`;
  }

  // 获取当前应该展示的菜品（考虑换菜状态）
  function getCurrentDish(dateStr, mealKey, idx, dish) {
    const key = getSwapKey(dateStr, mealKey, idx);
    const altIdx = swapState[key] || 0;
    if (altIdx === 0 || !dish.alternatives || !dish.alternatives[altIdx - 1]) {
      return dish;
    }
    // 返回备选菜，但保留 alternatives 引用
    return { ...dish.alternatives[altIdx - 1], alternatives: dish.alternatives, _originalName: dish.name };
  }

  // ===== 日期标签 =====
  function renderDateTabs() {
    const container = $('#dateTabs');
    container.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = formatDate(d);
      const tab = document.createElement('div');
      tab.className = 'date-tab' + (dateStr === currentDate ? ' active' : '') + (i === 0 ? ' today' : '');
      tab.dataset.date = dateStr;

      const label = i <= 2 ? DAY_LABELS[i] : `${(d.getMonth() + 1)}/${d.getDate()}`;
      tab.innerHTML = `
        <span class="day-name">${label}</span>
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
    const loading = $('#loading');
    const emptyState = $('#emptyState');
    const container = $('#mealsContainer');

    loading.style.display = 'flex';
    emptyState.style.display = 'none';
    container.style.display = 'none';

    if (menuCache[dateStr]) {
      renderMenu(menuCache[dateStr]);
      return;
    }

    try {
      const resp = await fetch(`data/${dateStr}.json`);
      if (!resp.ok) throw new Error('No data');
      const data = await resp.json();
      menuCache[dateStr] = data;
      renderMenu(data);
    } catch (e) {
      loading.style.display = 'none';
      emptyState.style.display = 'block';
    }
  }

  // ===== 渲染菜谱 =====
  function renderMenu(data) {
    $('#loading').style.display = 'none';
    $('#emptyState').style.display = 'none';
    $('#mealsContainer').style.display = 'block';

    // 日期和总览
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

    // 各餐
    renderMealSection('breakfastBody', 'breakfast', data.breakfast);
    renderMealSection('lunchBody', 'lunch', data.lunch);
    renderMealSection('dinnerBody', 'dinner', data.dinner);
    renderMealSection('fruitBody', 'fruit', data.fruit);
    renderMealSection('snackBody', 'snack', data.snack);

    // 小贴士
    if (data.tips) {
      $('#tipsBody').innerHTML = data.tips.map(t => `<p>• ${t}</p>`).join('');
      $('#tipsCard').style.display = 'block';
    } else {
      $('#tipsCard').style.display = 'none';
    }

    // 触发动画
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
      const currentDish = getCurrentDish(currentDate, mealKey, idx, dish);
      const hasAlts = dish.alternatives && dish.alternatives.length > 0;
      const swapKey = getSwapKey(currentDate, mealKey, idx);
      const isSwapped = (swapState[swapKey] || 0) > 0;

      return `
      <div class="dish-item${isSwapped ? ' dish-swapped' : ''}" id="dish-${mealKey}-${idx}">
        <div class="dish-emoji">${currentDish.emoji || '🍽️'}</div>
        <div class="dish-info">
          <div class="dish-name">
            ${currentDish.name}
            ${(currentDish.tags || []).map(t => `<span class="dish-tag ${t.type}">${t.label}</span>`).join('')}
            ${isSwapped ? '<span class="dish-tag swapped">已换</span>' : ''}
          </div>
          ${currentDish.desc ? `<div class="dish-desc">${currentDish.desc}</div>` : ''}
          ${currentDish.amount ? `<div class="dish-amount">👨‍👦 ${currentDish.amount}</div>` : ''}
        </div>
        <div class="dish-actions">
          ${hasAlts ? `<button class="dish-swap-btn" data-meal="${mealKey}" data-idx="${idx}" title="换一道菜">🔄</button>` : ''}
          ${currentDish.recipe ? `<button class="dish-recipe-btn" data-meal="${containerId}" data-idx="${idx}">做法</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  // ===== 换一个 =====
  function swapDish(mealKey, idx) {
    const data = menuCache[currentDate];
    if (!data) return;
    const dishes = data[mealKey];
    if (!dishes || !dishes[idx]) return;

    const dish = dishes[idx];
    if (!dish.alternatives || dish.alternatives.length === 0) return;

    const swapKey = getSwapKey(currentDate, mealKey, idx);
    const currentAlt = swapState[swapKey] || 0;
    const totalOptions = dish.alternatives.length + 1; // 原菜 + 备选
    const nextAlt = (currentAlt + 1) % totalOptions;

    swapState[swapKey] = nextAlt;
    saveSwapState();

    // 重新渲染该餐段
    const containerIdMap = {
      breakfast: 'breakfastBody',
      lunch: 'lunchBody',
      dinner: 'dinnerBody',
      fruit: 'fruitBody',
      snack: 'snackBody',
    };
    renderMealSection(containerIdMap[mealKey], mealKey, dishes);

    // 给被换的菜一个高亮动画
    const dishEl = $(`#dish-${mealKey}-${idx}`);
    if (dishEl) {
      dishEl.classList.add('dish-swap-anim');
      setTimeout(() => dishEl.classList.remove('dish-swap-anim'), 500);
    }
  }

  // ===== 做法弹窗 =====
  function showRecipe(containerId, idx) {
    const keyMap = {
      breakfastBody: 'breakfast',
      lunchBody: 'lunch',
      dinnerBody: 'dinner',
      fruitBody: 'fruit',
      snackBody: 'snack',
    };
    const mealKey = keyMap[containerId];
    const data = menuCache[currentDate];
    if (!data) return;

    const dishes = data[mealKey];
    if (!dishes || !dishes[idx]) return;

    const dish = dishes[idx];
    const currentDish = getCurrentDish(currentDate, mealKey, idx, dish);
    const recipe = currentDish.recipe;
    if (!recipe) return;

    $('#recipeTitle').textContent = `📝 ${currentDish.name} - 做法`;
    $('#recipeBody').innerHTML = `
      ${recipe.ingredients ? `
        <div class="recipe-section">
          <h4>🥬 食材准备</h4>
          <ul>${recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
        </div>
      ` : ''}
      ${recipe.steps ? `
        <div class="recipe-section">
          <h4>👩‍🍳 烹饪步骤</h4>
          <ul class="recipe-steps">${recipe.steps.map(s => `<li>${s}</li>`).join('')}</ul>
        </div>
      ` : ''}
      ${recipe.tips ? `
        <div class="recipe-section">
          <h4>💡 小窍门</h4>
          <ul>${recipe.tips.map(t => `<li>${t}</li>`).join('')}</ul>
        </div>
      ` : ''}
    `;

    $('#recipeModal').classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeRecipeModal() {
    $('#recipeModal').classList.remove('show');
    document.body.style.overflow = '';
  }

  // ===== 历史回看 =====
  function openHistory() {
    $('#historyDate').value = currentDate;
    $('#historyOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeHistory() {
    $('#historyOverlay').classList.remove('show');
    document.body.style.overflow = '';
  }

  function goHistory() {
    const val = $('#historyDate').value;
    if (!val) return;
    closeHistory();

    document.querySelectorAll('.date-tab').forEach(t => t.classList.remove('active'));
    currentDate = val;
    loadMenu(val);
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    // 菜品区域事件委托
    $('#mealsContainer').addEventListener('click', (e) => {
      // 做法按钮
      const recipeBtn = e.target.closest('.dish-recipe-btn');
      if (recipeBtn) {
        showRecipe(recipeBtn.dataset.meal, parseInt(recipeBtn.dataset.idx));
        return;
      }
      // 换一个按钮
      const swapBtn = e.target.closest('.dish-swap-btn');
      if (swapBtn) {
        swapDish(swapBtn.dataset.meal, parseInt(swapBtn.dataset.idx));
        return;
      }
    });

    // 关闭做法弹窗
    $('#closeRecipe').addEventListener('click', closeRecipeModal);
    $('#recipeModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeRecipeModal();
    });

    // 历史
    $('#historyBtn').addEventListener('click', openHistory);
    $('#closeHistory').addEventListener('click', closeHistory);
    $('#historyGo').addEventListener('click', goHistory);
    $('#historyOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeHistory();
    });

    // 回到今天
    $('#backToday').addEventListener('click', () => {
      currentDate = formatDate(today);
      renderDateTabs();
      loadMenu(currentDate);
    });
  }

  // ===== 启动 =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

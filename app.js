/**
 * 每日家庭食谱 - 核心 JS
 * 负责：日期切换、数据加载、菜谱渲染、做法弹窗、历史回看
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

  // ===== 初始化 =====
  function init() {
    const season = getSeason(today.getMonth() + 1);
    $('#seasonTag').textContent = season.emoji + ' ' + season.name;
    renderDateTabs();
    bindEvents();
    loadMenu(currentDate);
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
      tab.className = 'date-tab' + (i === 0 ? ' active today' : '');
      tab.dataset.date = dateStr;

      let label = i === 0 ? '今天' : i === 1 ? '明天' : '后天';
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
    renderMealSection('breakfastBody', data.breakfast);
    renderMealSection('lunchBody', data.lunch);
    renderMealSection('dinnerBody', data.dinner);
    renderMealSection('fruitBody', data.fruit);
    renderMealSection('snackBody', data.snack);

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

  function renderMealSection(containerId, dishes) {
    const container = $(`#${containerId}`);
    if (!dishes || dishes.length === 0) {
      container.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;">暂无数据</p>';
      return;
    }

    container.innerHTML = dishes.map((dish, idx) => `
      <div class="dish-item">
        <div class="dish-emoji">${dish.emoji || '🍽️'}</div>
        <div class="dish-info">
          <div class="dish-name">
            ${dish.name}
            ${(dish.tags || []).map(t => `<span class="dish-tag ${t.type}">${t.label}</span>`).join('')}
          </div>
          ${dish.desc ? `<div class="dish-desc">${dish.desc}</div>` : ''}
          ${dish.amount ? `<div class="dish-amount">👨‍👦 ${dish.amount}</div>` : ''}
        </div>
        ${dish.recipe ? `<button class="dish-recipe-btn" data-meal="${containerId}" data-idx="${idx}">做法</button>` : ''}
      </div>
    `).join('');
  }

  // ===== 做法弹窗 =====
  function showRecipe(mealKey, idx) {
    // 从 containerId 反推数据 key
    const keyMap = {
      breakfastBody: 'breakfast',
      lunchBody: 'lunch',
      dinnerBody: 'dinner',
      fruitBody: 'fruit',
      snackBody: 'snack',
    };
    const data = menuCache[currentDate];
    if (!data) return;

    const mealData = data[keyMap[mealKey]];
    if (!mealData || !mealData[idx]) return;

    const dish = mealData[idx];
    const recipe = dish.recipe;
    if (!recipe) return;

    $('#recipeTitle').textContent = `📝 ${dish.name} - 做法`;
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

    // 移除现有 active
    document.querySelectorAll('.date-tab').forEach(t => t.classList.remove('active'));
    currentDate = val;
    loadMenu(val);
  }

  // ===== 事件绑定 =====
  function bindEvents() {
    // 做法按钮（事件委托）
    $('#mealsContainer').addEventListener('click', (e) => {
      const btn = e.target.closest('.dish-recipe-btn');
      if (btn) {
        showRecipe(btn.dataset.meal, parseInt(btn.dataset.idx));
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

# 🍱 每日家庭食谱 Daily Menu

一个自动生成每日三餐菜谱的静态网页应用，专为中国家庭设计。

## ✨ 特性

- 📱 **移动端优先** - 完美适配微信内置浏览器
- 🤖 **AI 自动生成** - GitHub Actions 每日定时调用 AI 生成菜谱
- 🥬 **时令食材** - 根据季节自动推荐当季蔬菜水果
- 👨‍👦 **家庭定量** - 精确标注成人和青少年用量
- 📖 **详细做法** - 每道菜都有食材清单和步骤
- 📅 **历史回看** - 支持查看任意日期的菜谱记录
- 🌙 **深色模式** - 跟随系统自动切换
- ⚖️ **营养均衡** - 参考《中国居民膳食指南(2022)》

## 🍽️ 菜谱标准

- 📍 **深圳家庭**，日常偏广东饮食，兼容南北口味
- **平日（工作日）**：妈妈 + 儿子（青少年），2人份，注重简单高效
- **节假日/周末**：爸爸 + 妈妈 + 儿子，3人份，可以做丰盛些
- 每日包含：早餐、午餐、晚餐、水果、零食/加餐
- 结合南北方口味，包含酸甜辣多种风味
- 兼顾大米和面食等主食，适当融入广东特色
- 遵循中国儿童膳食指南推荐标准

## 🚀 部署方式

本项目通过 GitHub Pages 部署：

1. Fork 本仓库
2. 在仓库 Settings > Secrets 中添加：
   - `OPENAI_API_KEY` - OpenAI API 密钥
   - `OPENAI_API_BASE` - (可选) API 代理地址
   - `OPENAI_MODEL` - (可选) 模型名称，默认 gpt-4o
3. 在 Settings > Pages 中启用 GitHub Pages（Source 选 GitHub Actions）
4. GitHub Actions 会每天凌晨 5:00 (北京时间) 自动生成菜谱

## 📁 项目结构

```
daily-menu/
├── index.html          # 主页面
├── style.css           # 样式（移动端优先）
├── app.js              # 核心逻辑
├── data/               # 菜谱 JSON 数据（按日期存储）
│   ├── 2026-04-04.json
│   ├── 2026-04-05.json
│   └── ...
├── scripts/
│   ├── generate_menu.py    # AI 菜谱生成脚本
│   └── requirements.txt    # Python 依赖
└── .github/workflows/
    ├── generate-menu.yml   # 每日自动生成工作流
    └── deploy-pages.yml    # GitHub Pages 部署工作流
```

## 🔧 手动生成菜谱

```bash
cd scripts
pip install -r requirements.txt
export OPENAI_API_KEY=your-key-here
python generate_menu.py
```

## 📱 微信访问

部署成功后，直接在微信中打开 GitHub Pages 链接即可，页面已针对微信内置浏览器做了适配。

---

> 参考标准：《中国居民膳食指南(2022)》| 中国营养学会

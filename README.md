# 🍱 每日家庭食谱 Daily Menu

一个自动生成每日三餐菜谱的静态网页应用，专为中国家庭设计。

## ✨ 特性

- 📱 **移动端优先** - 完美适配微信内置浏览器
- 🤖 **AI 自动生成** - GitHub Actions 每天 0 点自动生成未来 3 天菜谱
- 🔄 **不满意就换** - 每道菜都有 2 个备选方案，一键切换保持营养均衡
- 🥬 **时令食材** - 根据季节自动推荐当季蔬菜水果
- 👨‍👩‍👦 **智能份量** - 工作日 2 人份（妈妈+儿子）/ 节假日 3 人份（全家）
- 📖 **详细做法** - 每道菜都有食材清单和步骤
- 📅 **历史回看** - 支持查看任意日期的菜谱记录
- 🌙 **深色模式** - 跟随系统自动切换
- ⚖️ **营养均衡** - 参考《中国居民膳食指南(2022)》
- 🔒 **数据不丢失** - 已生成的菜谱不会被覆盖，每天只新增1天数据

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
2. 在仓库 Settings > Secrets and variables > Actions 中添加以下 Secrets：

| Secret 名称 | 必填 | 说明 |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | API 密钥 |
| `OPENAI_API_BASE` | ❌ | API 地址（如使用代理或兼容接口）。例如：`https://your-proxy.com/v1` |
| `OPENAI_MODEL` | ❌ | 模型名称，默认 `gpt-4o`。支持任何 OpenAI 兼容模型 |

3. 在 Settings > Pages 中启用 GitHub Pages（Source 选 GitHub Actions）
4. GitHub Actions 会每天北京时间 **0:00** 自动检查并生成缺失的未来 3 天菜谱
5. **已存在的菜谱数据不会被覆盖**，每天实际上只需新增第3天的菜谱

> 💡 支持任何兼容 OpenAI API 格式的模型服务，只需设置 `OPENAI_API_BASE` 指向你的服务地址即可。

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

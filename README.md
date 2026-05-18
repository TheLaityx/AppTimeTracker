# 应用时长 (AppTimeTracker)

一款轻量的 Windows 桌面应用使用时长追踪工具，基于 Tauri 2 + Rust + SQLite 构建。

## ✨ 功能特性

- 🕐 **实时追踪** — 每 2 秒轮询前台窗口，精确记录各应用使用时长
- 📊 **可视化图表** — 今日按小时柱状图、7天/30天按日柱状图
- 🏆 **应用排行** — 使用时长 Top 20 排行榜，附带进度条和图标
- 🌙 **明暗主题** — 跟随系统自动切换亮色/暗色主题，毛玻璃效果
- 🔒 **隐私保护** — 首次启动隐私政策提示，数据完全本地存储
- 🚀 **开机自启** — 支持设置开机自动启动，最小化到系统托盘
- ⚙️ **可配置** — 自定义数据刷新间隔，一键清理数据

## 📸 截图

<img width="842" height="1264" alt="1779084503005-019e39b2-bd6a-7a93-933b-07b2080a3f22" src="https://github.com/user-attachments/assets/cef95b24-c216-42e6-a969-fae74c69193e" />


## 📥 下载安装

前往 [Releases](https://github.com/TheLaityx/AppTimeTracker/releases) 页面下载最新版安装包。

- `应用时长_1.0.0_x64-setup.exe` — NSIS 安装包（推荐）

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Rust + Tauri v2 |
| 数据库 | SQLite (WAL 模式) |
| 前端 | Vanilla JS + CSS Variables |
| 构建 | Vite + Cargo |

## 📁 项目结构

```
AppTimeTracker/
├── src/                    # 前端源码
│   ├── main.js             # 应用入口、导航
│   ├── app.js              # 应用核心逻辑
│   ├── theme.js            # 明暗主题切换
│   ├── utils.js            # 工具函数
│   └── views/
│       ├── home.js         # 主界面（图表+排行）
│       ├── settings.js     # 设置页
│       └── welcome.js      # 欢迎页
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── lib.rs          # Tauri 入口、托盘、命令注册
│   │   ├── tracker.rs      # 窗口轮询追踪 + 图标提取
│   │   ├── commands.rs     # Tauri 命令处理
│   │   └── db.rs           # SQLite 数据库操作
│   ├── Cargo.toml
│   └── tauri.conf.json
├── index.html
├── package.json
└── vite.config.js
```

## 🔧 开发构建

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable)
- [Tauri CLI](https://tauri.app/start/prerequisites/) v2

### 开发模式

```bash
# 安装前端依赖
npm install

# 启动开发服务器
npm run tauri dev
```

### 生产构建

```bash
# 构建安装包
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`。

## 📋 数据说明

- 数据存储在本地 SQLite 文件中，不上传任何服务器
- 自动清理 35 天前的历史数据
- 数据库采用 WAL 模式，读写互不阻塞

## 📄 许可证

MIT License

---

如果觉得有用，欢迎 ⭐ Star！

# 🌐 OpenClaw Workspace Browser

[English](README.md) | **简体中文**

一个为 OpenClaw 设计的轻量级个人工作空间文件浏览器，提供 Web 界面浏览本地文件系统。支持 Markdown 渲染、HTML 直接运行、图片预览等功能。

## 功能特点

- 📂 **浏览文件系统** - 安全地浏览指定目录下的所有文件和文件夹
- 📝 **Markdown 渲染** - 自动渲染 Markdown 文件，支持高亮和代码块
- 🎮 **HTML 运行** - HTML 文件可直接在浏览器中运行（适合小游戏、演示等）
- 🖼️ **图片预览** - 内嵌图片预览，无需下载
- 📱 **移动端友好** - 响应式设计，面包屑导航支持滑动
- 🔒 **基础认证** - 支持 HTTP Basic Auth 保护访问
- ⚡ **轻量快速** - 纯 Node.js 实现，无需数据库

## 安装

```bash
npm install
```

## 配置

1. 复制示例配置文件：

```bash
cp config.sample.json config.json
```

2. 编辑 `config.json`：

```json
{
  "port": 8888,
  "auth": {
    "user": "your_username",
    "pass": "your_password"
  },
  "baseDir": "~/.openclaw/workspace",
  "pinnedFolders": [
    "blog",
    "games",
    "research",
    "todo",
    "projects",
    "Notes",
    "QuickNotes"
  ],
  "skipNames": [
    "node_modules",
    "__pycache__",
    ".git",
    ".DS_Store"
  ]
}
```

**配置说明：**

- `port` - 服务端口号
- `auth` - HTTP Basic Auth 认证（留空则无需认证）
- `baseDir` - 要浏览的基础目录（支持 `~` 展开为用户主目录）
- `pinnedFolders` - 首页显示的固定文件夹
- `skipNames` - 浏览时隐藏的文件/文件夹名称

## 运行

直接运行：

```bash
npm start
```

访问 `http://localhost:8888`

## PM2 管理

使用 PM2 守护进程运行：

```bash
# 启动
pm2 start src/server.js --name openclaw-workspace-browser

# 停止
pm2 stop openclaw-workspace-browser

# 重启
pm2 restart openclaw-workspace-browser

# 查看日志
pm2 logs openclaw-workspace-browser

# 开机自启
pm2 startup
pm2 save
```

## 使用示例

### 浏览文件

访问首页，查看所有固定文件夹，点击进入即可浏览。

### 查看 Markdown

Markdown 文件会自动渲染，支持：
- 标题、列表、代码块
- 表格（支持全屏查看）
- 链接、图片

### 运行 HTML/JS 小游戏

将 HTML 文件放在 `games/` 目录下，访问时可直接在浏览器中运行。

### 下载文件

点击文件详情页的"下载"按钮，或使用 `/__download/路径` 端点直接下载。

## 技术栈

- **Node.js** - 运行时
- **Express** - Web 框架
- **EJS** - 模板引擎
- **marked** - Markdown 解析
- **highlight.js** - 代码高亮

## 安全

- 路径遍历防护（禁止访问 `baseDir` 外的文件）
- 基础认证保护（可选）
- 仅浏览文件系统，不提供写操作

## 许可

MIT License

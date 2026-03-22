const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const ejs = require('ejs');

// Load env
const browserUser = process.env.BROWSER_USER || 'jerry';
const browserPass = process.env.BROWSER_PASS || '6DRCTzIWeacVF5';

// Basic Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Workspace Browser"');
    res.status(401).send('Unauthorized');
    return;
  }
  const [username, password] = Buffer.from(authHeader.slice(6), 'base64').toString().split(':');
  if (username === browserUser && password === browserPass) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Workspace Browser"');
    res.status(401).send('Unauthorized');
  }
}

const app = express();
const PORT = 8888;
const BASE_DIR = path.resolve(process.env.HOME, '.openclaw', 'workspace');
const PINNED_FOLDERS = ['Blog', 'Games', 'Research','todo','src'];
const SKIP_NAMES = new Set(['node_modules', '__pycache__', '.git']);

// Configure marked
marked.setOptions({ gfm: true, breaks: true });

// Wrap tables with fullscreen button
const origParse = marked.parse.bind(marked);
marked.parse = function (content) {
  let html = origParse(content);
  html = html.replace(/<table>/g,
    '<div class="md-table-wrapper"><button class="table-fullscreen-btn" onclick="toggleTableFullscreen(this)">⛶ 全屏</button><div class="table-scroll-container"><table class="md-table">');
  html = html.replace(/<\/table>/g, '</table></div></div>');
  return html;
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Static server for running HTML files (games, etc.)
app.use('/static-run', express.static(BASE_DIR));

// Download endpoint for files
app.get('/download/*', (req, res) => {
  const decoded = decodeURIComponent(req.params[0]);
  const filePath = path.resolve(BASE_DIR, decoded);

  // Security: prevent traversal
  if (!filePath.startsWith(BASE_DIR)) {
    return res.status(403).send('Forbidden');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).send('File not found');
  }

  const fileName = path.basename(filePath);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.sendFile(filePath, { root: '/' });
});

// Auth disabled — proxy-server handles auth above this layer
// app.use(authMiddleware);

// ── helpers ──────────────────────────────────────────────

function safeStat(p) {
  try { return fs.statSync(p); } catch { return null; }
}

function readUtf8(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
}

/** Extract H1 title and first prose line from markdown text */
function extractMdInfo(text) {
  const lines = text.split('\n');
  let title = null, desc = '';
  for (const l of lines) {
    if (!title && l.startsWith('# ')) { title = l.slice(2).trim(); continue; }
    if (title) {
      const t = l.trim();
      if (t && !t.startsWith('#') && !t.startsWith('-') && !t.startsWith('*')
        && !t.startsWith('|') && !/^\d+\.\s/.test(t)) {
        desc = t.slice(0, 120);
        break;
      }
    }
  }
  // If no title found, try again for desc from beginning
  if (!title) {
    for (const l of lines) {
      const t = l.trim();
      if (t && !t.startsWith('#') && !t.startsWith('-') && !t.startsWith('*')
        && !t.startsWith('|') && !/^\d+\.\s/.test(t)) {
        desc = t.slice(0, 120);
        break;
      }
    }
  }
  return { title, desc };
}

/** Get display info for a file */
function getFileInfo(fullPath, name) {
  if (name.endsWith('.md')) {
    const info = extractMdInfo(readUtf8(fullPath));
    return {
      title: info.title || name.replace(/\.md$/i, ''),
      desc: info.desc
    };
  }
  return { title: name, desc: '' };
}

/** Get display info for a folder */
function getFolderInfo(fullPath, name) {
  const readmePath = path.join(fullPath, 'README.md');
  if (fs.existsSync(readmePath)) {
    const info = extractMdInfo(readUtf8(readmePath));
    return { title: info.title || name, desc: info.desc };
  }
  return { title: name, desc: '' };
}

/** Get modification time of an entry (for folders, use folder's own mtime) */
function getMtime(fullPath) {
  const st = safeStat(fullPath);
  return st ? st.mtimeMs : 0;
}

/**
 * Sort directory entries per requirements:
 * - isRoot=true: pinned first (Blog/Games/Research), then non-hidden dirs, hidden dirs, non-hidden files, hidden files
 * - isRoot=false: non-hidden dirs, hidden dirs, non-hidden files, hidden files
 * Within each group: sort by mtime descending
 */
function sortEntries(entries, isRoot) {
  const pinned = [];
  const normalDirs = [];
  const hiddenDirs = [];
  const normalFiles = [];
  const hiddenFiles = [];

  for (const e of entries) {
    if (SKIP_NAMES.has(e.name)) continue;
    const isHidden = e.name.startsWith('.');
    const isDir = e.isDirectory();

    if (isRoot && isDir) {
      const pinnedIdx = PINNED_FOLDERS.findIndex(p => p.toLowerCase() === e.name.toLowerCase());
      if (pinnedIdx >= 0) { e._pinnedIdx = pinnedIdx; pinned.push(e); continue; }
    }

    if (isDir) {
      (isHidden ? hiddenDirs : normalDirs).push(e);
    } else {
      (isHidden ? hiddenFiles : normalFiles).push(e);
    }
  }

  const byMtimeDesc = (a, b) => b._mtime - a._mtime;
  pinned.sort((a, b) => a._pinnedIdx - b._pinnedIdx);
  normalDirs.sort(byMtimeDesc);
  hiddenDirs.sort(byMtimeDesc);
  normalFiles.sort(byMtimeDesc);
  hiddenFiles.sort(byMtimeDesc);

  return [...pinned, ...normalDirs, ...hiddenDirs, ...normalFiles, ...hiddenFiles];
}

/** Build breadcrumb HTML items from a relative path (relative to BASE_DIR) */
function buildBreadcrumb(relPath) {
  const items = ['<a href="/">🏠 首页</a>'];
  if (!relPath) return items;
  const parts = relPath.split('/').filter(Boolean);
  let acc = '';
  for (const p of parts) {
    acc += (acc ? '/' : '') + p;
    items.push(`<a href="/${acc}/">${p}</a>`);
  }
  return items;
}

/** Check if entry should show a run button */
function shouldShowRunBtn(fullPath, name, isDir) {
  if (!isDir && name.endsWith('.html')) return true;
  if (isDir && fs.existsSync(path.join(fullPath, 'index.html'))) return true;
  return false;
}

// ── route: home & directory listing ──────────────────────

async function renderDirectory(reqPath, isRoot) {
  let entries;
  try {
    entries = fs.readdirSync(reqPath, { withFileTypes: true });
  } catch {
    return null;
  }

  // Attach mtime to each entry
  for (const e of entries) {
    e._mtime = getMtime(path.join(reqPath, e.name));
  }

  const sorted = sortEntries(entries, isRoot);
  const relDir = path.relative(BASE_DIR, reqPath);
  const breadcrumbItems = buildBreadcrumb(relDir);

  const items = [];
  for (const e of sorted) {
    const fullPath = path.join(reqPath, e.name);
    const relPath = path.relative(BASE_DIR, fullPath);
    const isDir = e.isDirectory();

    // Get display info
    let title, desc;
    if (isDir) {
      const info = getFolderInfo(fullPath, e.name);
      title = info.title;
      desc = info.desc;
    } else {
      const info = getFileInfo(fullPath, e.name);
      title = info.title;
      desc = info.desc;
    }

    // Path display: relative to current directory
    const pathDisplay = e.name + (isDir ? '/' : '');

    // Run button: .html files or folders with index.html
    let runBtn = '';
    if (shouldShowRunBtn(fullPath, e.name, isDir)) {
      // For html files: open the file directly via static serving
      // For folders with index.html: open the folder path (which serves index.html)
      const target = isDir ? `/static-run/${relPath}/` : `/static-run/${relPath}`;
      runBtn = `<a href="${target}" target="_blank" class="run-game-btn" onclick="event.stopPropagation();">▶</a>`;
    }

    const href = isDir ? `/${relPath}/` : `/${relPath}`;
    const cls = isDir ? 'folder' : 'file';
    items.push(`<div class="item ${cls}" onclick="window.location.href='${href}'" style="cursor:pointer;"><div class="item-path">${pathDisplay}</div><div class="item-title">${escHtml(title)}</div><div class="item-desc">${escHtml(desc)}</div>${runBtn}</div>`);
  }

  return await ejs.renderFile(path.join(__dirname, 'views', 'layout.ejs'), {
    title: isRoot ? '🦀 小明的个人网站' : `${path.basename(reqPath)} - 小明的个人网站`,
    content: items.join(''),
    breadcrumbItems,
    showToggle: false
  });
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Render file info page for files browser cannot open directly */
async function renderFileInfo(filePath, relPath, stat, res) {
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const size = formatFileSize(stat.size);
  const mtime = stat.mtime.toLocaleString('zh-CN');

  // Determine icon based on extension
  let icon = '📄';
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'].includes(ext)) icon = '📦';
  else if (['.doc', '.docx', '.odt', '.rtf', '.pages'].includes(ext)) icon = '📝';
  else if (['.xls', '.xlsx', '.ods', '.csv', '.numbers'].includes(ext)) icon = '📊';
  else if (['.ppt', '.pptx', '.odp', '.keynote'].includes(ext)) icon = '📽️';
  else if (['.psd', '.ai', '.sketch', '.fig', '.xd'].includes(ext)) icon = '🎨';
  else if (['.exe', '.msi', '.dmg', '.pkg', '.deb', '.rpm', '.appimage'].includes(ext)) icon = '⚙️';
  else if (['.iso', '.img', '.vmdk', '.qcow2'].includes(ext)) icon = '💿';
  else if (['.db', '.sqlite', '.sql', '.mdb'].includes(ext)) icon = '🗄️';
  else if (['.log', '.out'].includes(ext)) icon = '📋';

  const html = await ejs.renderFile(path.join(__dirname, 'views', 'layout.ejs'), {
    title: `${fileName} - 文件信息`,
    content: `
      <div class="file-info-card">
        <div class="file-icon">${icon}</div>
        <h1 class="file-name">${escHtml(fileName)}</h1>
        <div class="file-meta">
          <div class="meta-item">
            <span class="meta-label">文件类型</span>
            <span class="meta-value">${ext || '无扩展名'}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">文件大小</span>
            <span class="meta-value">${size}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">修改时间</span>
            <span class="meta-value">${mtime}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">完整路径</span>
            <span class="meta-value path">${escHtml(relPath)}</span>
          </div>
        </div>
        <div class="file-actions">
          <a href="/download/${relPath}" class="btn btn-primary" download>⬇️ 下载文件</a>
          <button class="btn btn-secondary" onclick="copyPath('${escHtml(relPath)}')">📋 复制路径</button>
        </div>
      </div>
    `,
    breadcrumbItems: ['<a href="/">🏠 首页</a>', `<span>${escHtml(fileName)}</span>`],
    showToggle: false
  });

  res.send(html);
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ── route: markdown rendering ────────────────────────────

async function renderMarkdown(filePath) {
  const raw = readUtf8(filePath);
  const html = marked.parse(raw);
  const relPath = path.relative(BASE_DIR, filePath);
  const fileName = path.basename(filePath);

  // Breadcrumb: all parts except last are links, last is plain text
  const parts = relPath.split('/').filter(Boolean);
  const breadcrumbItems = ['<a href="/">🏠 首页</a>'];
  let acc = '';
  for (let i = 0; i < parts.length - 1; i++) {
    acc += (acc ? '/' : '') + parts[i];
    breadcrumbItems.push(`<a href="/${acc}/">${parts[i]}</a>`);
  }
  breadcrumbItems.push(`<span>${fileName}</span>`);

  const escapedRaw = escHtml(raw);

  return await ejs.renderFile(path.join(__dirname, 'views', 'layout.ejs'), {
    title: `${fileName} - 小明的个人网站`,
    content: `<div id="rendered" class="content">${html}</div><pre id="raw" class="raw-view">${escapedRaw}</pre>`,
    breadcrumbItems,
    showToggle: true
  });
}

// ── routes ───────────────────────────────────────────────

// Home page
app.get('/', async (req, res) => {
  try {
    const html = await renderDirectory(BASE_DIR, true);
    if (!html) return res.status(500).send('Cannot read workspace');
    res.send(html);
  } catch (err) {
    console.error('Home error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Catch-all for workspace browsing
app.use(async (req, res) => {
  try {
    const decoded = decodeURIComponent(req.path).replace(/^\//, '');
    const reqPath = path.resolve(BASE_DIR, decoded);

    // Security: prevent traversal
    if (!reqPath.startsWith(BASE_DIR)) return res.status(403).send('Forbidden');

    if (!fs.existsSync(reqPath)) {
      // Try adding trailing slash for directories
      if (!req.path.endsWith('/') && !path.extname(req.path)) {
        if (fs.existsSync(reqPath) && safeStat(reqPath)?.isDirectory()) {
          return res.redirect(req.path + '/');
        }
      }
      return res.status(404).send('Not Found');
    }

    const stat = fs.statSync(reqPath);

    if (stat.isDirectory()) {
      // Redirect to trailing slash if missing
      if (!req.path.endsWith('/')) return res.redirect(req.path + '/');
      const isRoot = reqPath === BASE_DIR;
      const html = await renderDirectory(reqPath, isRoot);
      if (!html) return res.status(500).send('Error reading directory');
      return res.send(html);
    }

    // File handling
    if (reqPath.endsWith('.md')) {
      const html = await renderMarkdown(reqPath);
      return res.send(html);
    }

    // All other files: redirect to static-run for proper content-type handling
    // const relToBase = path.relative(BASE_DIR, reqPath);
    // return res.redirect(`/static-run/${relToBase}`);
    // 非 Markdown 文件：用静态文件中间件处理
    return express.static(BASE_DIR, {
        index: false,
        dotfiles: 'ignore',
        extensions: false
    })(req, res, () => {});
  } catch (err) {
    console.error('Route error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

const fs = require('fs');
const path = require('path');
const {
  BASE_DIR, PINNED_FOLDERS, SKIP_NAMES,
  safeStat, readUtf8, escHtml, extractMdInfo,
  buildBreadcrumb, renderLayout,
} = require('./helpers');

function getFileInfo(fullPath, name) {
  if (name.endsWith('.md')) {
    const info = extractMdInfo(readUtf8(fullPath));
    return { title: info.title || name.replace(/\.md$/i, ''), desc: info.desc };
  }
  return { title: name, desc: '' };
}

function getFolderInfo(fullPath, name) {
  const readmePath = path.join(fullPath, 'README.md');
  if (fs.existsSync(readmePath)) {
    const info = extractMdInfo(readUtf8(readmePath));
    return { title: info.title || name, desc: info.desc };
  }
  return { title: name, desc: '' };
}

function getMtime(fullPath) {
  const st = safeStat(fullPath);
  return st ? st.mtimeMs : 0;
}

function sortEntries(entries, isRoot) {
  const pinned = [], normalDirs = [], hiddenDirs = [], normalFiles = [], hiddenFiles = [];

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

function shouldShowRunBtn(fullPath, name, isDir) {
  if (!isDir && name.endsWith('.html')) return true;
  if (isDir && fs.existsSync(path.join(fullPath, 'index.html'))) return true;
  return false;
}

async function renderDirectory(reqPath, isRoot) {
  let entries;
  try {
    entries = fs.readdirSync(reqPath, { withFileTypes: true });
  } catch {
    return null;
  }

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

    let title, desc;
    if (isDir) {
      const info = getFolderInfo(fullPath, e.name);
      title = info.title; desc = info.desc;
    } else {
      const info = getFileInfo(fullPath, e.name);
      title = info.title; desc = info.desc;
    }

    const pathDisplay = e.name + (isDir ? '/' : '');

    let runBtn = '';
    if (shouldShowRunBtn(fullPath, e.name, isDir)) {
      const target = isDir ? `/__run/${relPath}/` : `/__run/${relPath}`;
      runBtn = `<a href="${target}" target="_blank" class="run-game-btn" onclick="event.stopPropagation();">▶</a>`;
    }

    const href = isDir ? `/${relPath}/` : `/${relPath}`;
    const cls = isDir ? 'folder' : 'file';
    items.push(`<div class="item ${cls}" onclick="window.location.href='${href}'" style="cursor:pointer;"><div class="item-path">${pathDisplay}</div><div class="item-title">${escHtml(title)}</div><div class="item-desc">${escHtml(desc)}</div>${runBtn}</div>`);
  }

  return await renderLayout({
    title: isRoot ? '🦀 小明的个人网站' : `${path.basename(reqPath)} - 小明的个人网站`,
    content: items.join(''),
    breadcrumbItems,
    showToggle: false,
  });
}

module.exports = {
  canRender(reqPath, stat) { return stat.isDirectory(); },
  render(reqPath, _relPath, _stat) {
    const isRoot = reqPath === BASE_DIR;
    return renderDirectory(reqPath, isRoot);
  },
};

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const config = require('../config');

// 展开 baseDir 中的 ~
let baseDir = config.baseDir || '~/.openclaw/workspace';
baseDir = baseDir.replace(/^~/, process.env.HOME);
if (!path.isAbsolute(baseDir)) {
  baseDir = path.resolve(process.cwd(), baseDir);
}

const BASE_DIR = baseDir;
const PINNED_FOLDERS = config.pinnedFolders || [];
const SKIP_NAMES = new Set(config.skipNames || []);
const LAYOUT_PATH = path.join(__dirname, '..', 'views', 'layout.ejs');

// Site configuration
const SITE_CONFIG = {
  title: config.site?.title || '个人网站',
  homeEmoji: config.site?.homeEmoji || '🏠',
  homeText: config.site?.homeText || '首页',
  rootTitlePrefix: config.site?.rootTitlePrefix || '',
};

function safeStat(p) {
  try { return fs.statSync(p); } catch { return null; }
}

function readUtf8(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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

function buildFileBreadcrumb(relPath) {
  const parts = relPath.split('/').filter(Boolean);
  const items = [`<a href="/">${SITE_CONFIG.homeEmoji} ${SITE_CONFIG.homeText}</a>`];
  let acc = '';
  for (let i = 0; i < parts.length - 1; i++) {
    acc += (acc ? '/' : '') + parts[i];
    items.push(`<a href="/${acc}/">${parts[i]}</a>`);
  }
  items.push(`<span>${parts[parts.length - 1]}</span>`);
  return items;
}

function buildBreadcrumb(relPath) {
  const items = [`<a href="/">${SITE_CONFIG.homeEmoji} ${SITE_CONFIG.homeText}</a>`];
  if (!relPath) return items;
  const parts = relPath.split('/').filter(Boolean);
  let acc = '';
  for (const p of parts) {
    acc += (acc ? '/' : '') + p;
    items.push(`<a href="/${acc}/">${p}</a>`);
  }
  return items;
}

async function renderLayout(opts) {
  return await ejs.renderFile(LAYOUT_PATH, opts);
}

module.exports = {
  BASE_DIR, PINNED_FOLDERS, SKIP_NAMES, SITE_CONFIG,
  safeStat, readUtf8, escHtml, formatFileSize,
  extractMdInfo, buildFileBreadcrumb, buildBreadcrumb,
  renderLayout,
};

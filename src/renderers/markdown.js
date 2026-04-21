const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');
const { readUtf8, escHtml, buildFileBreadcrumb, renderLayout, BASE_DIR, SITE_CONFIG, parseFrontMatter } = require('./helpers');

// Configure marked with syntax highlighting
marked.setOptions({
  gfm: true,
  breaks: true,
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (e) {
        // fallback to auto
      }
    }
    try {
      return hljs.highlightAuto(code).value;
    } catch (e) {
      return escHtml(code);
    }
  }
});

const origParse = marked.parse.bind(marked);
marked.parse = function (content) {
  let html = origParse(content);
  html = html.replace(/<table>/g,
    '<div class="md-table-wrapper"><button class="table-fullscreen-btn" onclick="toggleTableFullscreen(this)">⛶ 全屏</button><div class="table-scroll-container"><table class="md-table">');
  html = html.replace(/<\/table>/g, '</table></div></div>');
  return html;
};

function renderFrontMatter(attributes) {
  const entries = Object.entries(attributes).filter(([, value]) => value !== '');
  if (!entries.length) return '';

  const items = entries.map(([key, value]) => {
    const label = escHtml(key.replace(/[-_]+/g, ' '));
    const content = escHtml(String(value));
    return `<span class="frontmatter-chip"><span class="frontmatter-label">${label}</span><span class="frontmatter-value">${content}</span></span>`;
  }).join('');

  return `<section class="frontmatter-card">${items}</section>`;
}

async function renderMarkdown(filePath) {
  const raw = readUtf8(filePath);
  const { attributes, body } = parseFrontMatter(raw);
  const frontMatterHtml = renderFrontMatter(attributes);
  const html = marked.parse(body || raw);
  const relPath = path.relative(BASE_DIR, filePath);
  const fileName = path.basename(filePath);
  const breadcrumbItems = buildFileBreadcrumb(relPath);
  const escapedRaw = escHtml(raw);

  return await renderLayout({
    title: `${fileName} - ${SITE_CONFIG.title}`,
    content: `<div id="rendered" class="content">${frontMatterHtml}${html}</div><pre id="raw" class="raw-view">${escapedRaw}</pre>`,
    breadcrumbItems,
    showToggle: true,
  });
}

module.exports = {
  canRender(reqPath, stat) {
    return !stat.isDirectory() && path.extname(reqPath).toLowerCase() === '.md';
  },
  render: renderMarkdown,
};

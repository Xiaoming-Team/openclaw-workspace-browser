const path = require('path');
const { marked } = require('marked');
const { readUtf8, escHtml, buildFileBreadcrumb, renderLayout, BASE_DIR } = require('./helpers');

// Configure marked
marked.setOptions({ gfm: true, breaks: true });

const origParse = marked.parse.bind(marked);
marked.parse = function (content) {
  let html = origParse(content);
  html = html.replace(/<table>/g,
    '<div class="md-table-wrapper"><button class="table-fullscreen-btn" onclick="toggleTableFullscreen(this)">⛶ 全屏</button><div class="table-scroll-container"><table class="md-table">');
  html = html.replace(/<\/table>/g, '</table></div></div>');
  return html;
};

async function renderMarkdown(filePath) {
  const raw = readUtf8(filePath);
  const html = marked.parse(raw);
  const relPath = path.relative(BASE_DIR, filePath);
  const fileName = path.basename(filePath);
  const breadcrumbItems = buildFileBreadcrumb(relPath);
  const escapedRaw = escHtml(raw);

  return await renderLayout({
    title: `${fileName} - 小明的个人网站`,
    content: `<div id="rendered" class="content">${html}</div><pre id="raw" class="raw-view">${escapedRaw}</pre>`,
    breadcrumbItems,
    showToggle: true,
  });
}

module.exports = { renderMarkdown };

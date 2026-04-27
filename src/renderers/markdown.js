const path = require('path');
const { marked } = require('marked');
const hljs = require('highlight.js');
const { readUtf8, escHtml, buildFileBreadcrumb, renderLayout, BASE_DIR, SITE_CONFIG, parseFrontMatter } = require('./helpers');

const URL_PATTERN = String.raw`(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?::\d{2,5})?(?:[/?#][A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?`;
const BARE_URL_GLOBAL_RE = new RegExp(URL_PATTERN, 'gi');
const BARE_URL_AT_START_RE = new RegExp(`^${URL_PATTERN}`, 'i');
const INVALID_LEADING_CHAR_RE = /[A-Za-z0-9@_-]/;
const TRAILING_PUNCTUATION_RE = /[.,!?;:'"，。！？；：、】【》」』〉、]$/;
const ALLOWED_TLDS = new Set([
  'ai', 'app', 'blog', 'cc', 'cloud', 'cn', 'co', 'com', 'dev', 'fm', 'gg', 'info',
  'io', 'link', 'live', 'me', 'net', 'news', 'online', 'org', 'page', 'pro', 'sh',
  'site', 'so', 'studio', 'tech', 'top', 'tv', 'vip', 'wiki', 'world', 'xyz',
]);
const ALLOWED_SECOND_LEVEL_CN_TLDS = new Set(['ac', 'com', 'edu', 'gov', 'net', 'org']);

function hasValidLeadingBoundary(src, index) {
  if (index <= 0) return true;
  return !INVALID_LEADING_CHAR_RE.test(src[index - 1]);
}

function trimBalancedSuffix(rawUrl) {
  let url = rawUrl;

  while (TRAILING_PUNCTUATION_RE.test(url)) {
    url = url.slice(0, -1);
  }

  const balancedPairs = [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ];

  for (const [openChar, closeChar] of balancedPairs) {
    while (url.endsWith(closeChar)) {
      const openCount = [...url].filter(char => char === openChar).length;
      const closeCount = [...url].filter(char => char === closeChar).length;
      if (closeCount <= openCount) break;
      url = url.slice(0, -1);
    }
  }

  return url;
}

function toHref(rawUrl) {
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  return `https://${rawUrl}`;
}

function extractHostname(rawUrl) {
  try {
    return new URL(toHref(rawUrl)).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function hasAllowedDomainSuffix(rawUrl) {
  const hostname = extractHostname(rawUrl);
  if (!hostname) return false;

  const labels = hostname.split('.').filter(Boolean);
  if (labels.length < 2) return false;

  const tld = labels[labels.length - 1];
  if (ALLOWED_TLDS.has(tld)) return true;

  if (tld === 'cn' && labels.length >= 3) {
    const secondLevel = labels[labels.length - 2];
    return ALLOWED_SECOND_LEVEL_CN_TLDS.has(secondLevel);
  }

  return false;
}

function renderExternalLink(href, text) {
  return `<a href="${escHtml(href)}" target="_blank" rel="noopener noreferrer">${escHtml(text)}</a>`;
}

function findNextBareUrlMatch(src) {
  BARE_URL_GLOBAL_RE.lastIndex = 0;

  let match;
  while ((match = BARE_URL_GLOBAL_RE.exec(src)) !== null) {
    if (!hasValidLeadingBoundary(src, match.index)) continue;

    const raw = trimBalancedSuffix(match[0]);
    if (!raw) continue;
    if (!hasAllowedDomainSuffix(raw)) continue;

    return {
      index: match.index,
      raw,
      href: toHref(raw),
    };
  }

  return null;
}

function matchBareUrlAtStart(src) {
  const match = BARE_URL_AT_START_RE.exec(src);
  if (!match) return null;

  const raw = trimBalancedSuffix(match[0]);
  if (!raw) return null;
  if (!hasAllowedDomainSuffix(raw)) return null;

  return {
    raw,
    href: toHref(raw),
  };
}

marked.use({
  extensions: [{
    name: 'bareUrlLink',
    level: 'inline',
    start(src) {
      return findNextBareUrlMatch(src)?.index;
    },
    tokenizer(src) {
      const match = matchBareUrlAtStart(src);
      if (!match) return undefined;

      return {
        type: 'bareUrlLink',
        raw: match.raw,
        href: match.href,
        text: match.raw,
        tokens: [],
      };
    },
    renderer(token) {
      return renderExternalLink(token.href, token.text);
    },
  }],
});

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

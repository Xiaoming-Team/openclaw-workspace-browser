const path = require('path');
const hljs = require('highlight.js');
const { readUtf8, escHtml, formatFileSize, buildFileBreadcrumb, renderLayout } = require('./helpers');

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.cs',
  '.php', '.swift', '.kt', '.scala', '.lua', '.pl', '.r', '.m',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.xml', '.svg', '.graphql', '.gql',
  '.sql', '.prisma',
  '.dockerfile', '.gitignore', '.gitattributes', '.editorconfig',
  '.env', '.env.example', '.env.local',
  '.txt', '.log', '.csv', '.tsv',
  '.makefile', '.cmake',
  '.vue', '.svelte', '.astro',
  '.tf', '.hcl', '.nix',
  '.zig', '.dart', '.ex', '.exs', '.erl', '.hs', '.ml', '.clj',
]);

const LANG_MAP = {
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript', '.jsx': 'javascript',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
  '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
  '.cs': 'csharp', '.php': 'php', '.swift': 'swift', '.kt': 'kotlin',
  '.scala': 'scala', '.lua': 'lua', '.pl': 'perl', '.r': 'r',
  '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash', '.fish': 'bash',
  '.bat': 'dos', '.cmd': 'dos', '.ps1': 'powershell',
  '.html': 'html', '.htm': 'html', '.css': 'css',
  '.scss': 'scss', '.sass': 'scss', '.less': 'less',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
  '.toml': 'ini', '.ini': 'ini', '.cfg': 'ini', '.conf': 'nginx',
  '.xml': 'xml', '.svg': 'xml', '.graphql': 'graphql',
  '.sql': 'sql', '.dockerfile': 'dockerfile',
  '.makefile': 'makefile', '.cmake': 'cmake',
  '.vue': 'xml', '.svelte': 'xml',
  '.tf': 'hcl', '.hcl': 'hcl', '.nix': 'nix',
  '.zig': 'zig', '.dart': 'dart', '.ex': 'elixir', '.exs': 'elixir',
  '.erl': 'erlang', '.hs': 'haskell', '.ml': 'ocaml', '.clj': 'clojure',
  '.m': 'objectivec',
};

const MAX_TEXT_SIZE = 512 * 1024;

function isTextFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  const base = path.basename(fileName).toLowerCase();
  if (['makefile', 'dockerfile', 'rakefile', 'gemfile', 'procfile', 'vagrantfile'].includes(base)) return true;
  if (base.startsWith('.') && !ext) return true;
  return false;
}

function getLang(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (LANG_MAP[ext]) return LANG_MAP[ext];
  const base = path.basename(fileName).toLowerCase();
  if (base === 'makefile') return 'makefile';
  if (base === 'dockerfile') return 'dockerfile';
  return null;
}

async function renderTextFile(filePath, relPath, stat) {
  const fileName = path.basename(filePath);
  const size = formatFileSize(stat.size);
  const lang = getLang(fileName);

  let raw = readUtf8(filePath);
  let truncated = false;
  if (raw.length > MAX_TEXT_SIZE) {
    raw = raw.slice(0, MAX_TEXT_SIZE);
    truncated = true;
  }

  let highlighted;
  try {
    highlighted = lang
      ? hljs.highlight(raw, { language: lang }).value
      : hljs.highlightAuto(raw).value;
  } catch {
    highlighted = escHtml(raw);
  }

  const breadcrumbItems = buildFileBreadcrumb(relPath);
  const truncNote = truncated ? `<div class="truncate-note">文件过大，仅显示前 512KB</div>` : '';
  const safeFileName = escHtml(fileName);

  return await renderLayout({
    title: `${fileName} - 小明的个人网站`,
    content: `
      <div class="text-file-header">
        <div class="text-file-info">
          <span class="text-file-lang">${lang || path.extname(fileName) || 'text'}</span>
          <span class="text-file-size">${size}</span>
        </div>
        <div class="text-file-actions">
          <button class="btn btn-secondary btn-sm" onclick="copyFileName('${safeFileName}')">📋 复制文件名</button>
          <a href="/download/${encodeURI(relPath)}" class="btn btn-primary btn-sm" download>⬇️ 下载</a>
        </div>
      </div>
      ${truncNote}
      <div class="code-viewer"><pre><code class="hljs">${highlighted}</code></pre></div>
    `,
    breadcrumbItems,
    showToggle: false,
  });
}

module.exports = {
  canRender(reqPath, stat) {
    return !stat.isDirectory() && isTextFile(path.basename(reqPath)) && stat.size <= MAX_TEXT_SIZE * 2;
  },
  render: renderTextFile,
};

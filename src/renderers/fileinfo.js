const path = require('path');
const { escHtml, formatFileSize, buildFileBreadcrumb, renderLayout } = require('./helpers');

async function renderFileInfo(filePath, relPath, stat) {
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const size = formatFileSize(stat.size);
  const mtime = stat.mtime.toLocaleString('zh-CN');

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

  const safeRelPath = escHtml(relPath);

  return await renderLayout({
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
            <span class="meta-value path">${safeRelPath}</span>
          </div>
        </div>
        <div class="file-actions">
          <a href="/download/${encodeURI(relPath)}" class="btn btn-primary" download>⬇️ 下载文件</a>
          <button class="btn btn-secondary" onclick="copyPath('${safeRelPath}')">📋 复制路径</button>
        </div>
      </div>
    `,
    breadcrumbItems: buildFileBreadcrumb(relPath),
    showToggle: false,
  });
}

module.exports = { renderFileInfo };

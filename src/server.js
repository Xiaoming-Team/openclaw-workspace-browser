const express = require('express');
const fs = require('fs');
const path = require('path');

const { BASE_DIR, safeStat } = require('./renderers/helpers');
const { renderDirectory } = require('./renderers/directory');
const { renderMarkdown } = require('./renderers/markdown');
const { isTextFile, renderTextFile, MAX_TEXT_SIZE } = require('./renderers/textfile');
const { renderFileInfo } = require('./renderers/fileinfo');

const app = express();
const PORT = 8888;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Static server for running HTML files (games, etc.)
app.use('/static-run', express.static(BASE_DIR));

// Download endpoint
app.get('/download/{*filePath}', (req, res) => {
  const parts = Array.isArray(req.params.filePath) ? req.params.filePath : [req.params.filePath];
  const decoded = decodeURIComponent(parts.join('/'));
  const filePath = path.resolve(BASE_DIR, decoded);

  if (!filePath.startsWith(BASE_DIR)) {
    return res.status(403).send('Forbidden');
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).send('File not found');
  }

  const fileName = path.basename(filePath);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

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
const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg']);
const MEDIA_EXTS = new Set(['.mp4', '.webm', '.ogg', '.mov', '.mp3', '.wav', '.flac', '.aac', '.m4a', '.pdf']);

app.use(async (req, res) => {
  try {
    const decoded = decodeURIComponent(req.path).replace(/^\//, '');
    const reqPath = path.resolve(BASE_DIR, decoded);

    if (!reqPath.startsWith(BASE_DIR)) return res.status(403).send('Forbidden');

    if (!fs.existsSync(reqPath)) {
      if (!req.path.endsWith('/') && !path.extname(req.path)) {
        if (fs.existsSync(reqPath) && safeStat(reqPath)?.isDirectory()) {
          return res.redirect(req.path + '/');
        }
      }
      return res.status(404).send('Not Found');
    }

    const stat = fs.statSync(reqPath);

    if (stat.isDirectory()) {
      if (!req.path.endsWith('/')) return res.redirect(req.path + '/');
      const isRoot = reqPath === BASE_DIR;
      const html = await renderDirectory(reqPath, isRoot);
      if (!html) return res.status(500).send('Error reading directory');
      return res.send(html);
    }

    // File handling
    const relPath = path.relative(BASE_DIR, reqPath);
    const ext = path.extname(reqPath).toLowerCase();

    if (ext === '.md') {
      return res.send(await renderMarkdown(reqPath));
    }

    if (isTextFile(path.basename(reqPath)) && stat.size <= MAX_TEXT_SIZE * 2) {
      return res.send(await renderTextFile(reqPath, relPath, stat));
    }

    if (IMG_EXTS.has(ext)) {
      return res.sendFile(relPath, { root: BASE_DIR });
    }

    if (MEDIA_EXTS.has(ext)) {
      return res.sendFile(relPath, { root: BASE_DIR });
    }

    // Binary / unknown files: file info page
    return res.send(await renderFileInfo(reqPath, relPath, stat));
  } catch (err) {
    console.error('Route error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

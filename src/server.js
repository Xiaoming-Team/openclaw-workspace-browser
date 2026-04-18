const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const { BASE_DIR, safeStat } = require('./renderers/helpers');

// Renderer chain: order matters, first match wins. fileinfo is the fallback (always matches).
const renderers = [
  require('./renderers/directory'),
  require('./renderers/markdown'),
  require('./renderers/image'),
  require('./renderers/textfile'),
  require('./renderers/media'),
  require('./renderers/fileinfo'),
];

const app = express();
const PORT = config.port || 8888;

// Basic auth middleware
if (config.auth && config.auth.user && config.auth.pass) {
  const basicAuth = (req, res, next) => {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Workspace Browser"');
      return res.status(401).send('Authentication required');
    }

    const encoded = authHeader.split(' ')[1];
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    const [user, pass] = decoded.split(':');

    if (user === config.auth.user && pass === config.auth.pass) {
      next();
    } else {
      res.setHeader('WWW-Authenticate', 'Basic realm="Workspace Browser"');
      res.status(401).send('Invalid credentials');
    }
  };

  // Apply auth to all routes
  app.use(basicAuth);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Static server for running HTML files (games, etc.)
app.use('/__run', express.static(BASE_DIR));

// Download endpoint
app.get('/__download/{*filePath}', (req, res) => {
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
    const stat = fs.statSync(BASE_DIR);
    const renderer = renderers.find(r => r.canRender(BASE_DIR, stat));
    const html = await renderer.render(BASE_DIR, '', stat);
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

    if (stat.isDirectory() && !req.path.endsWith('/')) {
      return res.redirect(req.path + '/');
    }

    const relPath = path.relative(BASE_DIR, reqPath);
    const renderer = renderers.find(r => r.canRender(reqPath, stat));

    if (renderer.sendFile) {
      return res.sendFile(relPath, { root: BASE_DIR });
    }

    const html = await renderer.render(reqPath, relPath, stat);
    if (!html) return res.status(500).send('Error rendering');
    return res.send(html);
  } catch (err) {
    console.error('Route error:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

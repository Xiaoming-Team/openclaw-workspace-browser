const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PROJECT_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(PROJECT_DIR, 'test');
const FIXTURE_NAME = 'auto-url-cases.md';

function startServer() {
  const port = 5100 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: PROJECT_DIR,
    env: {
      ...process.env,
      WORKSPACE_BROWSER_PORT: String(port),
      WORKSPACE_BROWSER_BASE_DIR: FIXTURE_DIR,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    stderr += chunk.toString();
  });

  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Server did not start in time.\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    }, 10000);

    child.stdout.on('data', chunk => {
      if (chunk.toString().includes(`http://localhost:${port}`)) {
        clearTimeout(timer);
        resolve();
      }
    });

    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Server exited early with code ${code}.\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    });
  });

  return {
    port,
    child,
    ready,
    stop: async () => {
      if (child.exitCode !== null) return;
      child.kill('SIGTERM');
      await new Promise(resolve => child.once('exit', resolve));
    },
  };
}

test('auto-links bare domain URLs and preserves adjacent Chinese text', async () => {
  const server = startServer();
  await server.ready;

  try {
    const response = await fetch(`http://127.0.0.1:${server.port}/${FIXTURE_NAME}`);
    assert.equal(response.status, 200);

    const body = await response.text();
    assert.match(body, /href="https:\/\/example\.com\/path"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>example\.com\/path<\/a>后面还是中文/);
    assert.match(body, /href="https:\/\/docs\.foo-bar\.dev\/net\/test\?x=1#hash"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>docs\.foo-bar\.dev\/net\/test\?x=1#hash<\/a>，结尾的中文不能被吃进去/);
    assert.match(body, /href="https:\/\/workspace-browser\.dev\/hello-world"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>https:\/\/workspace-browser\.dev\/hello-world<\/a>。/);
    assert.doesNotMatch(body, /href="https:\/\/src\.renderers\/markdown\.js"/);
    assert.doesNotMatch(body, /href="https:\/\/app\.bundle\.ts"/);
    assert.doesNotMatch(body, /href="https:\/\/styles\/main\.css"/);
    assert.doesNotMatch(body, /href="https:\/\/utils\/helper\.jsx"/);
  } finally {
    await server.stop();
  }
});

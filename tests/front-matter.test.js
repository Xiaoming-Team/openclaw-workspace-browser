const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawn } = require('node:child_process');

const PROJECT_DIR = path.resolve(__dirname, '..');
const FIXTURE_DIR = path.join(PROJECT_DIR, 'test');

function startServer() {
  const port = 4100 + Math.floor(Math.random() * 1000);
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

test('renders markdown front matter as a dedicated metadata block', async () => {
  const server = startServer();
  await server.ready;

  try {
    const response = await fetch(`http://127.0.0.1:${server.port}/front-matter.md`);
    assert.equal(response.status, 200);

    const body = await response.text();
    assert.match(body, /frontmatter-card/);
    assert.match(body, /Front Matter 标题/);
    assert.match(body, /这是一段用于回归测试的摘要/);
    assert.match(body, /<h1>正文标题<\/h1>/);
    assert.doesNotMatch(body, /<p>title: Front Matter 标题/);
    assert.doesNotMatch(body, /<hr>\s*<p>title: Front Matter 标题/);
  } finally {
    await server.stop();
  }
});

test('uses front matter title and description in directory cards', async () => {
  const server = startServer();
  await server.ready;

  try {
    const response = await fetch(`http://127.0.0.1:${server.port}/`);
    assert.equal(response.status, 200);

    const body = await response.text();
    assert.match(body, /front-matter\.md/);
    assert.match(body, /item-title">Front Matter 标题</);
    assert.match(body, /item-desc">这是一段用于回归测试的摘要</);
  } finally {
    await server.stop();
  }
});

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

let config = null;

function loadConfig() {
  if (config) return config;

  // 默认配置
  const defaultConfig = {
    port: 8888,
    baseDir: '~/.openclaw/workspace',
    pinnedFolders: [],
    skipNames: ['node_modules', '__pycache__', '.git', '.DS_Store'],
  };

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const userConfig = JSON.parse(raw);
    config = { ...defaultConfig, ...userConfig };
  } catch (err) {
    console.warn('Failed to load config.json, using defaults:', err.message);
    config = defaultConfig;
  }

  // 展开 baseDir 中的 ~
  if (config.baseDir) {
    config.baseDir = config.baseDir.replace(/^~/, process.env.HOME);
    if (!path.isAbsolute(config.baseDir)) {
      config.baseDir = path.resolve(process.cwd(), config.baseDir);
    }
  }

  return config;
}

module.exports = loadConfig();

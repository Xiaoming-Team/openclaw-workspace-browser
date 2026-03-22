const path = require('path');

const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg']);

module.exports = {
  canRender(reqPath, stat) {
    return !stat.isDirectory() && IMG_EXTS.has(path.extname(reqPath).toLowerCase());
  },
  sendFile: true,
};

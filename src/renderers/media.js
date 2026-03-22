const path = require('path');

const MEDIA_EXTS = new Set(['.mp4', '.webm', '.ogg', '.mov', '.mp3', '.wav', '.flac', '.aac', '.m4a', '.pdf']);

module.exports = {
  canRender(reqPath, stat) {
    return !stat.isDirectory() && MEDIA_EXTS.has(path.extname(reqPath).toLowerCase());
  },
  sendFile: true,
};

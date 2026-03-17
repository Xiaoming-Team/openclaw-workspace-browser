const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const ejs = require('ejs');

const app = express();
const PORT = 8888;
const BASE_DIR = path.join(__dirname, '..', 'research');

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configure marked - wrap tables in div for horizontal scroll
marked.setOptions({
    gfm: true,
    breaks: true
});

const originalRender = marked.parse;
marked.parse = function(content) {
    let html = originalRender.call(this, content);
    // Wrap tables in three-layer structure: wrapper > scroll-container > table
    // Pattern: <table>...</table> -> <div class="md-table-wrapper"><button class="table-fullscreen-btn">⛶ 全屏</button><div class="table-scroll-container"><table class="md-table">...</table></div></div>
    html = html.replace(/<table>/g, '<div class="md-table-wrapper"><button class="table-fullscreen-btn" onclick="toggleTableFullscreen(this)">⛶ 全屏</button><div class="table-scroll-container"><table class="md-table">');
    html = html.replace(/<\/table>/g, '</table></div></div>');
    return html;
};

// Get file title and description from markdown file
function getFileInfo(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        let title = path.basename(filePath);
        let desc = '';
        
        for (const line of lines) {
            // Get H1 title
            if (line.startsWith('# ')) {
                title = line.substring(2).trim();
            }
        }
        
        for (const line of lines) {
            const trimmed = line.trim();
            // Skip: headers (#), list items, table headers (|)
            // But INCLUDE blockquotes (>) - they often contain the file description
            if (trimmed && 
                !trimmed.startsWith('#') && 
                !trimmed.startsWith('-') && 
                !trimmed.startsWith('*') &&
                !trimmed.startsWith('|') &&
                !/^\d+\.\s/.test(trimmed)) {
                desc = trimmed.substring(0, 100);
                break;
            }
        }
        return { title, desc };
    } catch (e) {
        return { title: path.basename(filePath), desc: '' };
    }
}

// Read project info dynamically from README.md
function getProjectInfo(folderName) {
    const readmePath = path.join(BASE_DIR, folderName, 'README.md');
    try {
        const content = fs.readFileSync(readmePath, 'utf-8');
        const lines = content.split('\n');
        let title = folderName;
        let desc = '';
        
        for (const line of lines) {
            if (line.startsWith('# ')) {
                title = line.substring(2).trim();
                break;
            }
        }
        
        for (const line of lines) {
            const trimmed = line.trim();
            // Skip: headers (#), list items (- or * or numbers.), table headers (|)
            // But INCLUDE blockquotes (>) - they often contain the file description
            if (trimmed && 
                !trimmed.startsWith('#') && 
                !trimmed.startsWith('-') && 
                !trimmed.startsWith('*') &&
                !trimmed.startsWith('|') &&
                !/^\d+\.\s/.test(trimmed)) {
                desc = trimmed.substring(0, 100);
                break;
            }
        }
        
        return { title, desc };
    } catch (e) {
        return { title: folderName, desc: '' };
    }
}

function autolink(html) {
    return html.replace(/(<a[^>]*href=["'])([^"']+)(["'][^>]*>)/g, (match, prefix, url, suffix) => {
        return prefix + url + suffix;
    }).replace(/(?<!href=["'])(https?:\/\/[^\s<>"')]+)/g, '<a href="$1" target="_blank">$1</a>');
}

// Read file with encoding detection
function readFile(filepath) {
    const encodings = ['utf-8', 'gbk', 'gb2312', 'latin1'];
    for (const enc of encodings) {
        try {
            return fs.readFileSync(filepath, enc);
        } catch (e) {
            continue;
        }
    }
    return '';
}

// Generate breadcrumb items
function buildBreadcrumb(relPath) {
    const parts = relPath.split('/').filter(p => p);
    let breadcrumbPath = '';
    const breadcrumbItems = ['<a href="/">🏠 首页</a>'];
    
    for (let i = 0; i < parts.length; i++) {
        breadcrumbPath += (i > 0 ? '/' : '') + parts[i];
        breadcrumbItems.push(`<a href="/${breadcrumbPath}/">${parts[i]}</a>`);
    }
    
    return breadcrumbItems;
}

// Generate folder index (async)
async function generateIndex(reqPath) {
    const items = [];
    const dirs = fs.readdirSync(reqPath, { withFileTypes: true }).filter(d => !d.name.startsWith(".") && !["node_modules", "__pycache__"].includes(d.name));
    
    // 分离文件夹和文件
    const folders = dirs.filter(d => d.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    const files = dirs.filter(d => !d.isDirectory() && d.name.endsWith('.md')).sort((a, b) => a.name.localeCompare(b.name));
    const sortedDirs = [...folders, ...files];
    
    // Build breadcrumb
    let relPath = path.relative(BASE_DIR, reqPath);
    if (relPath === reqPath) relPath = '';
    const breadcrumbItems = buildBreadcrumb(relPath);
    
    for (const dir of sortedDirs) {
        const fullPath = path.join(reqPath, dir.name);
        const relPath = path.relative(BASE_DIR, fullPath);
        
        if (dir.isDirectory()) {
            const proj = getProjectInfo(dir.name);
            const title = proj.title || `📁 ${dir.name}`;
            const desc = proj.desc || '';
            items.push(`<a href="/${relPath}/" class="item folder"><div class="item-path">${relPath}/</div><div class="item-title">${title}</div><div class="item-desc">${desc}</div></a>`);
        } else if (dir.name.endsWith('.md')) {
            const fileInfo = getFileInfo(fullPath);
            const title = fileInfo.title || `📄 ${dir.name}`;
            const desc = fileInfo.desc || '';
            items.push(`<a href="/${relPath}" class="item file"><div class="item-path">${relPath}</div><div class="item-title">${title}</div><div class="item-desc">${desc}</div></a>`);
        }
    }
    
    return await ejs.renderFile(path.join(__dirname, 'views', 'layout.ejs'), {
        title: '🦀 小明的研究资料',
        content: items.join(''),
        breadcrumbItems: breadcrumbItems,
        showToggle: false
    });
}

// Generate content page (async)
async function generatePage(filepath) {
    const rawContent = readFile(filepath);
    const mdHtml = marked.parse(rawContent);
    const processedHtml = autolink(mdHtml);
    
    const title = path.basename(filepath);
    const relPath = path.relative(BASE_DIR, filepath);
    
    // Build breadcrumb
    const parts = relPath.split('/');
    let breadcrumbPath = '';
    const breadcrumbItems = ['<a href="/">🏠 首页</a>'];
    
    for (let i = 0; i < parts.length - 1; i++) {
        breadcrumbPath += (i > 0 ? '/' : '') + parts[i];
        breadcrumbItems.push(`<a href="/${breadcrumbPath}/">${parts[i]}</a>`);
    }
    breadcrumbItems.push(`<span>${parts[parts.length - 1]}</span>`);
    
    return await ejs.renderFile(path.join(__dirname, 'views', 'layout.ejs'), {
        title: title,
        content: `<div id="rendered" class="content">${processedHtml}</div><pre id="raw" style="display:none;background:#1e293b;color:#e2e8f0;padding:20px;border-radius:8px;overflow:auto;font-size:14px;white-space:pre-wrap;word-wrap:break-word;">${rawContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
        breadcrumbItems: breadcrumbItems,
        showToggle: true
    });
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', async (req, res) => {
    const html = await generateIndex(BASE_DIR);
    res.send(html);
});

app.use(async (req, res) => {
    let reqPath = path.join(BASE_DIR, decodeURIComponent(req.path).replace(/\/$/, ''));
    
    // Security: prevent directory traversal
    if (!reqPath.startsWith(BASE_DIR)) {
        return res.status(403).send('Forbidden');
    }
    
    if (fs.existsSync(reqPath)) {
        const stat = fs.statSync(reqPath);
        if (stat.isDirectory()) {
            const html = await generateIndex(reqPath);
            res.send(html);
        } else if (reqPath.endsWith('.md')) {
            const html = await generatePage(reqPath);
            res.send(html);
        } else {
            res.sendFile(reqPath);
        }
    } else {
        res.status(404).send('Not Found');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

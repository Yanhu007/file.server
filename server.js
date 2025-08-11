const express = require('express');
const http = require('http');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 3100;

// 文件存储目录
const FILE_EXPLORER_DIR = path.join(__dirname, 'file-explorer');
// 下载统计存储文件
const DOWNLOAD_STATS_FILE = path.join(__dirname, 'download-stats.json');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 确保file-explorer目录存在
fs.ensureDirSync(FILE_EXPLORER_DIR);

// 初始化下载统计数据
async function initDownloadStats() {
  try {
    if (!await fs.pathExists(DOWNLOAD_STATS_FILE)) {
      await fs.writeJSON(DOWNLOAD_STATS_FILE, {});
    }
  } catch (error) {
    console.error('初始化下载统计失败:', error);
  }
}

// 获取下载统计
async function getDownloadStats() {
  try {
    if (await fs.pathExists(DOWNLOAD_STATS_FILE)) {
      return await fs.readJSON(DOWNLOAD_STATS_FILE);
    }
    return {};
  } catch (error) {
    console.error('读取下载统计失败:', error);
    return {};
  }
}

// 更新下载统计
async function updateDownloadStats(filePath) {
  try {
    const stats = await getDownloadStats();
    if (!stats[filePath]) {
      stats[filePath] = {
        count: 0,
        firstDownload: new Date().toISOString(),
        lastDownload: null
      };
    }
    stats[filePath].count += 1;
    stats[filePath].lastDownload = new Date().toISOString();
    await fs.writeJSON(DOWNLOAD_STATS_FILE, stats);
  } catch (error) {
    console.error('更新下载统计失败:', error);
  }
}

initDownloadStats();

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 使用查询参数而不是body参数
    const pathParam = req.query.path || '';
    const uploadPath = pathParam ? path.join(FILE_EXPLORER_DIR, pathParam) : FILE_EXPLORER_DIR;
    fs.ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// API路由

// 获取目录内容
app.get('/api/files', async (req, res) => {
  try {
    const requestedPath = req.query.path || '';
    const fullPath = path.join(FILE_EXPLORER_DIR, requestedPath);
    
    // 安全检查：确保路径在file-explorer目录内
    if (!fullPath.startsWith(FILE_EXPLORER_DIR)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }

    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({ error: '路径不存在' });
    }

    const items = await fs.readdir(fullPath);
    const fileList = [];

    for (const item of items) {
      const itemPath = path.join(fullPath, item);
      const stats = await fs.stat(itemPath);
      
      fileList.push({
        name: item,
        path: path.join(requestedPath, item).replace(/\\/g, '/'),
        isDirectory: stats.isDirectory(),
        size: stats.isDirectory() ? 0 : stats.size,
        lastModified: stats.mtime
      });
    }

    res.json({
      currentPath: requestedPath,
      items: fileList.sort((a, b) => {
        // 目录排在前面，然后按名称排序
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      })
    });
  } catch (error) {
    console.error('获取文件列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 创建目录
app.post('/api/mkdir', async (req, res) => {
  try {
    const { path: dirPath, name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '目录名称不能为空' });
    }

    const fullPath = path.join(FILE_EXPLORER_DIR, dirPath || '', name);
    
    // 安全检查
    if (!fullPath.startsWith(FILE_EXPLORER_DIR)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }

    if (await fs.pathExists(fullPath)) {
      return res.status(409).json({ error: '目录已存在' });
    }

    await fs.ensureDir(fullPath);
    res.json({ message: '目录创建成功' });
  } catch (error) {
    console.error('创建目录错误:', error);
    res.status(500).json({ error: '创建目录失败' });
  }
});

// 上传文件
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有选择文件' });
    }

    res.json({
      message: '文件上传成功',
      filename: req.file.filename,
      path: req.query.path || ''
    });
  } catch (error) {
    console.error('文件上传错误:', error);
    res.status(500).json({ error: '文件上传失败' });
  }
});

// 下载文件
app.get('/api/download/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = path.join(FILE_EXPLORER_DIR, filePath);
    
    // 安全检查
    if (!fullPath.startsWith(FILE_EXPLORER_DIR)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }

    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: '无法下载目录' });
    }

    // 更新下载统计
    await updateDownloadStats(filePath);

    res.download(fullPath);
  } catch (error) {
    console.error('文件下载错误:', error);
    res.status(500).json({ error: '文件下载失败' });
  }
});

// 删除文件或目录
app.delete('/api/delete/*', async (req, res) => {
  try {
    const itemPath = req.params[0];
    const fullPath = path.join(FILE_EXPLORER_DIR, itemPath);
    
    // 安全检查
    if (!fullPath.startsWith(FILE_EXPLORER_DIR)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }

    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({ error: '文件或目录不存在' });
    }

    await fs.remove(fullPath);
    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除错误:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

// 读取文件内容（用于编辑）
app.get('/api/edit/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = path.join(FILE_EXPLORER_DIR, filePath);
    
    // 安全检查
    if (!fullPath.startsWith(FILE_EXPLORER_DIR)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }

    if (!await fs.pathExists(fullPath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      return res.status(400).json({ error: '无法编辑目录' });
    }

    // 检查是否为可编辑的文本文件
    const ext = path.extname(fullPath).toLowerCase();
    const editableExtensions = ['.txt', '.json', '.csv', '.tsv', '.xml', '.html', '.css', '.js', '.md', '.yaml', '.yml', '.ini', '.conf', '.log'];
    
    if (!editableExtensions.includes(ext) && ext !== '') {
      return res.status(400).json({ error: '不支持编辑此类型的文件' });
    }

    const content = await fs.readFile(fullPath, 'utf8');
    res.json({
      content: content,
      filename: path.basename(fullPath),
      path: filePath
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: '文件不存在' });
    }
    console.error('读取文件错误:', error);
    res.status(500).json({ error: '读取文件失败' });
  }
});

// 保存文件内容
app.put('/api/edit/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    const fullPath = path.join(FILE_EXPLORER_DIR, filePath);
    const { content } = req.body;
    
    if (content === undefined) {
      return res.status(400).json({ error: '文件内容不能为空' });
    }

    // 安全检查
    if (!fullPath.startsWith(FILE_EXPLORER_DIR)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }

    // 确保目录存在
    const dirPath = path.dirname(fullPath);
    await fs.ensureDir(dirPath);

    // 检查是否为可编辑的文本文件
    const ext = path.extname(fullPath).toLowerCase();
    const editableExtensions = ['.txt', '.json', '.csv', '.tsv', '.xml', '.html', '.css', '.js', '.md', '.yaml', '.yml', '.ini', '.conf', '.log'];
    
    if (!editableExtensions.includes(ext) && ext !== '') {
      return res.status(400).json({ error: '不支持保存此类型的文件' });
    }

    await fs.writeFile(fullPath, content, 'utf8');
    res.json({ message: '文件保存成功' });
  } catch (error) {
    console.error('保存文件错误:', error);
    res.status(500).json({ error: '保存文件失败' });
  }
});

// 创建新文件
app.post('/api/create-file', async (req, res) => {
  try {
    const { path: dirPath, name, content = '' } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '文件名称不能为空' });
    }

    const fullPath = path.join(FILE_EXPLORER_DIR, dirPath || '', name);
    
    // 安全检查
    if (!fullPath.startsWith(FILE_EXPLORER_DIR)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }

    if (await fs.pathExists(fullPath)) {
      return res.status(409).json({ error: '文件已存在' });
    }

    // 确保目录存在
    const dirFullPath = path.dirname(fullPath);
    await fs.ensureDir(dirFullPath);

    await fs.writeFile(fullPath, content, 'utf8');
    res.json({ message: '文件创建成功' });
  } catch (error) {
    console.error('创建文件错误:', error);
    res.status(500).json({ error: '创建文件失败' });
  }
});

// Dashboard API 端点

// 获取下载统计数据
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = await getDownloadStats();
    
    // 过滤只显示 latest 目录下的文件
    const latestStats = {};
    for (const [filePath, data] of Object.entries(stats)) {
      if (filePath.startsWith('latest/')) {
        latestStats[filePath] = data;
      }
    }
    
    res.json(latestStats);
  } catch (error) {
    console.error('获取下载统计错误:', error);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// 获取 latest.json 配置信息
app.get('/api/dashboard/config', async (req, res) => {
  try {
    const configPath = path.join(FILE_EXPLORER_DIR, 'latest', 'latest.json');
    
    if (!await fs.pathExists(configPath)) {
      return res.status(404).json({ error: '配置文件不存在' });
    }
    
    const config = await fs.readJSON(configPath);
    res.json(config);
  } catch (error) {
    console.error('读取配置文件错误:', error);
    res.status(500).json({ error: '读取配置文件失败' });
  }
});

// 获取dashboard概览数据
app.get('/api/dashboard/overview', async (req, res) => {
  try {
    const stats = await getDownloadStats();
    const configPath = path.join(FILE_EXPLORER_DIR, 'latest', 'latest.json');
    
    let config = {};
    if (await fs.pathExists(configPath)) {
      config = await fs.readJSON(configPath);
    }
    
    // 计算总下载量和各平台下载量
    let totalDownloads = 0;
    const platformStats = {};
    
    for (const [filePath, data] of Object.entries(stats)) {
      if (filePath.startsWith('latest/')) {
        totalDownloads += data.count;
        
        // 根据文件名识别平台
        const fileName = path.basename(filePath);
        let platform = 'unknown';
        
        if (config.downloadUrls) {
          for (const [platformKey, downloadFile] of Object.entries(config.downloadUrls)) {
            if (fileName === downloadFile) {
              platform = platformKey;
              break;
            }
          }
        }
        
        if (!platformStats[platform]) {
          platformStats[platform] = {
            count: 0,
            files: []
          };
        }
        
        platformStats[platform].count += data.count;
        platformStats[platform].files.push({
          fileName,
          filePath,
          downloads: data.count,
          firstDownload: data.firstDownload,
          lastDownload: data.lastDownload
        });
      }
    }
    
    res.json({
      totalDownloads,
      platformStats,
      version: config.latest || 'Unknown',
      releaseDate: config.releaseDate || null,
      releaseNotes: config.releaseNotes || ''
    });
  } catch (error) {
    console.error('获取概览数据错误:', error);
    res.status(500).json({ error: '获取概览数据失败' });
  }
});

// 启动HTTP服务器
http.createServer(app).listen(HTTP_PORT, () => {
  console.log(`HTTP服务器运行在 http://localhost:${HTTP_PORT}`);
});